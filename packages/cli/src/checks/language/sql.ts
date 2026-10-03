import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { parseSql, parsePlpgsql } from '#cli/parsers/sql/pg.ts';
import { sqlFile, positionAt } from '#cli/parsers/sql/statements.ts';
import { trivialText } from '#cli/checks/general/structure/statements.ts';
import type { SqlFile, SqlStatementView } from '#cli/types/parsers/sql.ts';
import { TRIVIAL_STATEMENTS } from '#cli/config/checks/language/language.ts';
import type { Engine, Finding, EngineInput } from '#cli/types/execution/execution.ts';
import type { SqlSource, SqlAnalysis, FunctionOption } from '#cli/types/checks/language/sql.ts';

import {
    SQL_TOKENS,
    LINE_COMMENT,
    BLOCK_COMMENT,
    OUTPUT_PARAMETERS,
    POSTGRES_DIALECTS,
    FUNCTION_PARAMETERS,
} from '#cli/config/checks/language/sql.ts';

function sources(input: EngineInput): SqlSource[] {
    return input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            path: file.path,
            text: readSource(input.root, file.path, input.reads).toString('utf8'),
        }));
}

// Whether a PL/pgSQL node is one executable statement: a statement node other than a block, placed on a line.
function isProceduralStatement(key: string, child: unknown): boolean {
    if (!key.startsWith('PLpgSQL_stmt_') || key === 'PLpgSQL_stmt_block') return false;
    return ((child as { lineno?: number }).lineno ?? 0) > 0;
}

function proceduralStatements(value: unknown): number {
    if (value === null || typeof value !== 'object') return 0;
    if (Array.isArray(value)) return value.reduce<number>((count, child) => count + proceduralStatements(child), 0);
    let count = 0;
    for (const [key, child] of Object.entries(value)) {
        if (isProceduralStatement(key, child)) count += 1;
        count += proceduralStatements(child);
    }
    return count;
}

function sqlStatements(value: unknown): number {
    if (value === null || typeof value !== 'object') return 0;
    if (Array.isArray(value)) return value.reduce<number>((count, child) => count + sqlStatements(child), 0);
    let count = 0;
    for (const [key, child] of Object.entries(value)) count += (key.endsWith('Stmt') ? 1 : 0) + sqlStatements(child);
    return count;
}

// The argument of a `CREATE FUNCTION` option, by name.
function functionOption(statement: SqlStatementView, name: string): FunctionOption['DefElem']['arg'] | undefined {
    const options = (statement.fields['options'] ?? []) as FunctionOption[];
    return options.find(({ DefElem: option }) => option.defname === name)?.DefElem.arg;
}

// The executable statements of an SQL function: its standard body, or the string body parsed on its own.
async function sqlBody(statement: SqlStatementView): Promise<number> {
    const body = functionOption(statement, 'as')?.List?.items[0]?.String.sval;
    if (body === undefined) return sqlStatements(statement.fields['sql_body']);
    const parsedBody = await parseSql(body);
    if (parsedBody.error !== undefined) throw new Error(`Cannot analyze SQL function body: ${parsedBody.error.text}`);
    return sqlStatements(parsedBody.tree);
}

// The executable statements of a function body, or undefined for a language this check does not read.
async function bodyStatements(
    parsed: SqlFile,
    statement: SqlStatementView,
    index: number,
): Promise<number | undefined> {
    const language = functionOption(statement, 'language')?.String?.sval;
    if (language === 'plpgsql') {
        const end = parsed.statements[index + 1]?.start ?? parsed.source.length;
        return proceduralStatements(await parsePlpgsql(parsed.source.slice(statement.start, end)));
    }
    return language === 'sql' ? sqlBody(statement) : undefined;
}

// The findings of one `CREATE FUNCTION` statement, and whether the function is trivial.
async function functionFindings(
    analysis: SqlAnalysis,
    statement: SqlStatementView,
    index: number,
): Promise<{ findings: Finding[]; isTrivial: boolean }> {
    const { input, source, threshold, maximum, parsed } = analysis;
    const at = { file: source.path, ...positionAt(source.text, statement.start) };
    const findings: Finding[] = [];
    const parameters = (statement.fields['parameters'] ?? []) as { FunctionParameter: { mode: string } }[];
    const count = parameters.filter(
        ({ FunctionParameter: parameter }) => !OUTPUT_PARAMETERS.has(parameter.mode),
    ).length;
    if (count > maximum)
        findings.push(
            findingAt(
                input,
                at,
                'function-parameters',
                `${String(count)} declared input parameters exceeds ${String(maximum)}.`,
            ),
        );
    const statements = await bodyStatements(parsed, statement, index);
    const isTrivial = statements !== undefined && statements <= threshold;
    if (isTrivial)
        findings.push(findingAt(input, at, 'trivial-function', trivialText('This function', statements, threshold)));
    return { findings, isTrivial };
}

// The findings of one file: each function's, then the file's when every statement is a trivial function.
async function fileFindings(analysis: SqlAnalysis): Promise<Finding[]> {
    const { input, source, parsed } = analysis;
    const findings: Finding[] = [];
    let trivial = 0;
    for (const [index, statement] of parsed.statements.entries()) {
        if (statement.kind !== 'CreateFunctionStmt') continue;
        const found = await functionFindings(analysis, statement, index);
        findings.push(...found.findings);
        if (found.isTrivial) trivial += 1;
    }
    if (trivial > 0 && trivial === parsed.statements.length)
        findings.push(
            findingAt(
                input,
                { file: source.path, line: 1 },
                'trivial-file',
                'This file contains only trivial functions. Move them to their owner.',
            ),
        );
    return findings;
}

/**
 * One finding for each file Postgres refuses to parse. Another dialect has no parser here, so its files pass.
 * @param input the engine input
 * @returns the findings
 */
async function syntax(input: EngineInput): Promise<Finding[]> {
    const sqlfluff = input.view.tool('sqlfluff');
    const dialect = (sqlfluff['dialect'] as string | undefined) ?? 'ansi';
    if (!POSTGRES_DIALECTS.has(dialect)) return [];
    // The paths SQLFluff leaves out, such as templates with placeholders, are no SQL the parser reads either.
    const excluded = ((sqlfluff['exclude'] as { paths: string[] }[] | undefined) ?? []).flatMap((entry) => entry.paths);
    const isExcluded = pathMatcher(excluded);
    const findings: Finding[] = [];
    for (const source of sources(input).filter((entry) => !isExcluded(entry.path))) {
        const parsed = await sqlFile(source.text, input.reads);
        if (parsed.error === undefined) continue;
        const { text, line, column } = parsed.error;
        findings.push(findingAt(input, { file: source.path, line, column }, 'syntax', text));
    }
    return findings;
}

/**
 * One finding for each file that holds a block comment.
 * @param input the engine input
 * @returns the findings
 */
function blockComments(input: EngineInput): Finding[] {
    return sources(input).flatMap((source): Finding[] => {
        const found = source.text.matchAll(SQL_TOKENS).find((match) => match[0] === BLOCK_COMMENT);
        if (found === undefined) return [];
        return [
            findingAt(
                input,
                { file: source.path, ...positionAt(source.text, found.index) },
                'block-comment',
                'A block comment; write line comments, which the prose checks read.',
            ),
        ];
    });
}

/**
 * One finding for each file with more code lines than limits.sql.file_lines.
 * @param input the engine input
 * @returns the findings
 */
function fileLines(input: EngineInput): Finding[] {
    const ceiling = input.view.limit('file_lines', 'sql');
    if (ceiling === undefined) return [];
    return sources(input).flatMap((source): Finding[] => {
        const lines = source.text.split('\n').map((line) => line.trim());
        const count = lines.filter((line) => line !== '' && !line.startsWith(LINE_COMMENT)).length;
        if (count <= ceiling) return [];
        const said = `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`;
        return [findingAt(input, { file: source.path, line: 1 }, 'file-lines', said)];
    });
}

/**
 * Check implemented PostgreSQL functions and their declared input parameters.
 * @param input the engine input
 * @returns the findings
 */
async function functions(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    const threshold = input.view.limit('trivial_statements', 'sql') ?? TRIVIAL_STATEMENTS;
    const maximum = input.view.limit('function_parameters', 'sql') ?? FUNCTION_PARAMETERS;
    for (const source of sources(input)) {
        const parsed = await sqlFile(source.text, input.reads);
        if (parsed.error !== undefined)
            throw new Error(`Cannot analyze SQL functions in ${source.path}: ${parsed.error.text}`);
        findings.push(...(await fileFindings({ input, source, parsed, threshold, maximum })));
    }
    return findings;
}

/** The analyses this file provides, by the name a manifest check gives them. */
export const SQL_ANALYSES: Record<string, Engine> = {
    'sql/functions': functions,
    'sql/syntax': syntax,
    'sql/block-comments': blockComments,
    'sql/file-lines': fileLines,
};
