import { readSource } from '#cli/repository/tracked.ts';
import { parseSql, parsePlpgsql } from '#cli/parsers/sql/parser.ts';
import { sqlFile, positionAt } from '#cli/parsers/sql/statements.ts';
import type { SqlFile, SqlStatementView } from '#cli/types/parsers/sql.ts';
import { DEFAULT_TRIVIAL_STATEMENTS } from '#cli/config/checks/structure.ts';
import type { Finding, SqlSource, EngineInput, SqlAnalysis, FunctionOption } from '#cli/types/checks/checks.ts';

import {
    SQL_TOKENS,
    LINE_COMMENT,
    BLOCK_COMMENT,
    OUTPUT_PARAMETERS,
    POSTGRES_DIALECTS,
    SHIPPED_PARAMETER_LIMIT,
} from '#cli/config/checks/checks.ts';

function sources(input: EngineInput): SqlSource[] {
    return input.files
        .filter((file) => file.nature === 'source')
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
async function sqlBodyStatements(statement: SqlStatementView): Promise<number> {
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
    return language === 'sql' ? sqlBodyStatements(statement) : undefined;
}

// A finding at a statement of the source.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two function checks build the finding with its statement position; one owner keeps that shape.
function functionFinding(analysis: SqlAnalysis, statement: SqlStatementView, rule: string, text: string): Finding {
    const { input, source } = analysis;
    return {
        check: input.spec.name,
        file: source.path,
        ...positionAt(source.text, statement.start),
        rule,
        message: text,
        fixable: false,
    };
}

// The findings of one `CREATE FUNCTION` statement, and whether the function is trivial.
async function functionFindings(
    analysis: SqlAnalysis,
    statement: SqlStatementView,
    index: number,
): Promise<{ findings: Finding[]; isTrivial: boolean }> {
    const { threshold, maximum, parsed } = analysis;
    const findings: Finding[] = [];
    const parameters = (statement.fields['parameters'] ?? []) as { FunctionParameter: { mode: string } }[];
    const count = parameters.filter(
        ({ FunctionParameter: parameter }) => !OUTPUT_PARAMETERS.has(parameter.mode),
    ).length;
    if (count > maximum)
        findings.push(
            functionFinding(
                analysis,
                statement,
                'function-parameters',
                `${String(count)} declared input parameters exceeds ${String(maximum)}.`,
            ),
        );
    const statements = await bodyStatements(parsed, statement, index);
    const isTrivial = statements !== undefined && statements <= threshold;
    if (isTrivial)
        findings.push(
            functionFinding(
                analysis,
                statement,
                'trivial-function',
                `This function has ${String(statements)} executable statements, at most ${String(threshold)}. Inline it or suppress its required API with a reason.`,
            ),
        );
    return { findings, isTrivial };
}

// The findings of one file: each function's, then the file's when every statement is a trivial function.
async function fileFunctionFindings(analysis: SqlAnalysis): Promise<Finding[]> {
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
        findings.push({
            check: input.spec.name,
            file: source.path,
            line: 1,
            rule: 'trivial-file',
            message: 'This file contains only trivial functions. Move them to their owner.',
            fixable: false,
        });
    return findings;
}

/**
 * One finding for each file Postgres refuses to parse. Another dialect has no parser here, so its files pass.
 * @param input the engine input
 * @returns the findings
 */
export async function sqlSyntax(input: EngineInput): Promise<Finding[]> {
    const dialect = (input.view.tool('sqlfluff')['dialect'] as string | undefined) ?? 'ansi';
    if (!POSTGRES_DIALECTS.has(dialect)) return [];
    const findings: Finding[] = [];
    for (const source of sources(input)) {
        const parsed = await sqlFile(source.text, input.reads);
        if (parsed.error === undefined) continue;
        const { text, line, column } = parsed.error;
        findings.push({
            check: input.spec.name,
            file: source.path,
            line,
            column,
            rule: 'syntax',
            message: text,
            fixable: false,
        });
    }
    return findings;
}

/**
 * One finding for each file that holds a block comment.
 * @param input the engine input
 * @returns the findings
 */
export function sqlBlockComments(input: EngineInput): Finding[] {
    return sources(input).flatMap((source): Finding[] => {
        const found = source.text.matchAll(SQL_TOKENS).find((match) => match[0] === BLOCK_COMMENT);
        if (found === undefined) return [];
        return [
            {
                check: input.spec.name,
                file: source.path,
                ...positionAt(source.text, found.index),
                rule: 'block-comment',
                message: 'A block comment; write line comments, which the prose checks read.',
                fixable: false,
            },
        ];
    });
}

/**
 * One finding for each file with more code lines than limits.sql.file_lines.
 * @param input the engine input
 * @returns the findings
 */
export function sqlFileLength(input: EngineInput): Finding[] {
    const ceiling = input.view.limit('file_lines', 'sql');
    if (ceiling === undefined) return [];
    return sources(input).flatMap((source): Finding[] => {
        const lines = source.text.split('\n').map((line) => line.trim());
        const count = lines.filter((line) => line !== '' && !line.startsWith(LINE_COMMENT)).length;
        if (count <= ceiling) return [];
        const said = `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`;
        return [
            { check: input.spec.name, file: source.path, line: 1, rule: 'file-lines', message: said, fixable: false },
        ];
    });
}

/**
 * Check implemented PostgreSQL functions and their declared input parameters.
 * @param input the engine input
 * @returns the findings
 */
export async function sqlFunctions(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    const threshold = input.view.limit('trivial_statements', 'sql') ?? DEFAULT_TRIVIAL_STATEMENTS;
    const maximum = input.view.limit('function_parameters', 'sql') ?? SHIPPED_PARAMETER_LIMIT;
    for (const source of sources(input)) {
        const parsed = await sqlFile(source.text, input.reads);
        if (parsed.error !== undefined)
            throw new Error(`Cannot analyze SQL functions in ${source.path}: ${parsed.error.text}`);
        findings.push(...(await fileFunctionFindings({ input, source, parsed, threshold, maximum })));
    }
    return findings;
}
