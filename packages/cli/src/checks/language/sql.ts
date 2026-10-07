import { findingAt } from '#cli/checks/finding.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { readSource } from '#cli/platform/source.ts';
import { trivialText } from '#cli/parsers/statements.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { parse, parsePlpgsql } from '#cli/parsers/sql/pg.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { positionAt, parseSqlFile } from '#cli/parsers/sql/statements.ts';
import type { SqlFile, SqlStatementView } from '#cli/types/parsers/sql.ts';
import { LINE_COMMENT, PARSED_DIALECTS, OUTPUT_PARAMETERS } from '#cli/config/checks/language/sql.ts';

import type {
    SqlSource,
    SqlFileInput,
    FunctionOption,
    FunctionParameter,
    SqlFunctionFindings,
} from '#cli/types/checks/language/sql.ts';

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
    if (!isRecord(child)) return false;
    const line = child['lineno'];
    return typeof line === 'number' && line > 0;
}

function countNodes(value: unknown, isStatement: (key: string, child: unknown) => boolean): number {
    if (value === null || typeof value !== 'object') return 0;
    if (Array.isArray(value)) return value.reduce<number>((count, child) => count + countNodes(child, isStatement), 0);
    let count = 0;
    for (const [key, child] of Object.entries(value)) {
        if (isStatement(key, child)) count += 1;
        count += countNodes(child, isStatement);
    }
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
    let tree: unknown = statement.fields['sql_body'];
    if (body !== undefined) {
        const parsedBody = await parse(body);
        if (parsedBody.error !== undefined)
            throw new Error(`Cannot analyze SQL function body: ${parsedBody.error.text}`);
        tree = parsedBody.tree;
    }
    return countNodes(tree, (key) => key.endsWith('Stmt'));
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
        return countNodes(await parsePlpgsql(parsed.source.slice(statement.start, end)), isProceduralStatement);
    }
    return language === 'sql' ? sqlBody(statement) : undefined;
}

// The findings of one `CREATE FUNCTION` statement, and whether the function is trivial.
async function functionFindings(
    analysis: SqlFileInput,
    statement: SqlStatementView,
    index: number,
): Promise<SqlFunctionFindings> {
    const { input, source, threshold, maximum, parsed } = analysis;
    const at = { file: source.path, ...positionAt(source.text, statement.start) };
    const findings: Finding[] = [];
    const parameters = (statement.fields['parameters'] ?? []) as FunctionParameter[];
    const count = parameters.filter(
        ({ FunctionParameter: parameter }) => !OUTPUT_PARAMETERS.has(parameter.mode),
    ).length;
    if (maximum !== undefined && count > maximum)
        findings.push(
            findingAt(
                input,
                at,
                'function-parameters',
                `This function declares ${String(count)} input parameters, over the limit of ${String(maximum)}.`,
            ),
        );
    if (threshold === undefined) return { findings, isTrivial: false };
    const statements = await bodyStatements(parsed, statement, index);
    const isTrivial = statements !== undefined && statements <= threshold;
    if (isTrivial)
        findings.push(findingAt(input, at, 'trivial-function', trivialText('This function', statements, threshold)));
    return { findings, isTrivial };
}

// The findings of one file: each function's, then the file's when every statement is a trivial function.
async function fileFindings(analysis: SqlFileInput): Promise<Finding[]> {
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
export async function syntax(input: EngineInput): Promise<Finding[]> {
    const sqlfluff = input.view.options('tools.sqlfluff');
    const dialect = sqlfluff['dialect'] as string;
    if (!PARSED_DIALECTS.has(dialect)) return [];
    // The paths SQLFluff leaves out, such as templates with placeholders, are no SQL the parser reads either.
    const excluded = ((sqlfluff['exclude'] as PathAllowance[] | undefined) ?? []).flatMap((entry) => entry.paths);
    const isExcluded = pathMatcher(excluded);
    const findings: Finding[] = [];
    for (const source of sources(input).filter((entry) => !isExcluded(entry.path))) {
        const parsed = await parseSqlFile(source.text, input.reads);
        if (parsed.error === undefined) continue;
        const { text, line, column } = parsed.error;
        findings.push(findingAt(input, { file: source.path, line, column }, 'syntax', text));
    }
    return findings;
}

/**
 * One finding for each file with more code lines than limits.sql.file_lines.
 * @param input the engine input
 * @returns the findings
 */
export function fileLines(input: EngineInput): Finding[] {
    const ceiling = input.view.limit('file_lines', 'sql');
    if (ceiling === undefined) return [];
    return sources(input).flatMap((source): Finding[] => {
        const lines = source.text.split('\n').map((line) => line.trim());
        const count = lines.filter((line) => line !== '' && !line.startsWith(LINE_COMMENT)).length;
        if (count <= ceiling) return [];
        const diagnostic = `This file has ${String(count)} code lines, over the ceiling of ${String(ceiling)}.`;
        return [findingAt(input, { file: source.path, line: 1 }, 'file-lines', diagnostic)];
    });
}

/**
 * Report trivial PostgreSQL functions and excessive declared input parameters.
 * @param input the engine input
 * @returns the findings
 */
export async function trivialFunctions(input: EngineInput): Promise<Finding[]> {
    const sqlfluff = input.view.options('tools.sqlfluff');
    const dialect = sqlfluff['dialect'] as string;
    if (!PARSED_DIALECTS.has(dialect)) return [];
    const excluded = ((sqlfluff['exclude'] as PathAllowance[] | undefined) ?? []).flatMap((entry) => entry.paths);
    const isExcluded = pathMatcher(excluded);
    const findings: Finding[] = [];
    const threshold = input.view.limit('min_function_statements', 'sql');
    const maximum = input.view.limit('function_parameters', 'sql');
    if (threshold === undefined && maximum === undefined) return [];
    for (const source of sources(input).filter((entry) => !isExcluded(entry.path))) {
        const parsed = await parseSqlFile(source.text, input.reads);
        if (parsed.error !== undefined) continue;
        findings.push(...(await fileFindings({ input, source, parsed, threshold, maximum })));
    }
    return findings;
}
