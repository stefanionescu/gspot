import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { SqlStatementView } from '#cli/parsers/sql/types.ts';
import { parsePlpgsql, parseSql } from '#cli/parsers/sql/parser.ts';
import { positionAt, sqlFile } from '#cli/parsers/sql/statements.ts';

// The shipped limit on declared input parameters when the policy names none.
const SHIPPED_PARAMETER_LIMIT = 7;

const POSTGRES_DIALECTS = new Set(['postgres', 'ansi']);
const BLOCK_COMMENT = '/*';
const LINE_COMMENT = '--';
// A string, a quoted name, a line comment, or the start of a block comment, whichever comes first.
const SQL_TOKENS = /'[^']*'|"[^"]*"|--[^\n]*|\/\*/gu;

function sources(input: EngineInput): { path: string; text: string }[] {
    return input.files
        .filter((file) => file.nature === 'source')
        .map((file) => ({
            path: file.path,
            text: readSource(input.root, file.path, input.observations).toString('utf8'),
        }));
}

// The index of the first block comment outside a string and outside a line comment, or a negative number.
function blockCommentAt(text: string): number {
    const found = text.matchAll(SQL_TOKENS).find((match) => match[0] === BLOCK_COMMENT);
    return found?.index ?? -1;
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

type ParsedSql = Awaited<ReturnType<typeof sqlFile>>;
type SqlSource = ReturnType<typeof sources>[number];
type FunctionOption = {
    DefElem: { defname: string; arg: { String?: { sval: string }; List?: { items: { String: { sval: string } }[] } } };
};
type Analysis = { input: EngineInput; source: SqlSource; parsed: ParsedSql; threshold: number; maximum: number };

const OUTPUT_PARAMETERS = new Set(['FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE']);

// The declared input parameters of a function, leaving out its outputs and table columns.
function inputParameters(statement: SqlStatementView): number {
    const parameters = (statement.fields['parameters'] ?? []) as { FunctionParameter: { mode: string } }[];
    return parameters.filter(({ FunctionParameter: parameter }) => !OUTPUT_PARAMETERS.has(parameter.mode)).length;
}

// The argument of a CREATE FUNCTION option, by name.
function functionOption(statement: SqlStatementView, name: string): FunctionOption['DefElem']['arg'] | undefined {
    const options = (statement.fields['options'] ?? []) as FunctionOption[];
    return options.find(({ DefElem }) => DefElem.defname === name)?.DefElem.arg;
}

// The executable statements of a PL/pgSQL function, parsed from its definition text.
async function plpgsqlStatements(parsed: ParsedSql, statement: SqlStatementView, index: number): Promise<number> {
    const end = parsed.statements[index + 1]?.start ?? parsed.source.length;
    return proceduralStatements(await parsePlpgsql(parsed.source.slice(statement.start, end)));
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
    parsed: ParsedSql,
    statement: SqlStatementView,
    index: number,
): Promise<number | undefined> {
    const language = functionOption(statement, 'language')?.String?.sval;
    if (language === 'plpgsql') return plpgsqlStatements(parsed, statement, index);
    return language === 'sql' ? sqlBodyStatements(statement) : undefined;
}

// A finding at a statement of the source.
function functionFinding(analysis: Analysis, statement: SqlStatementView, rule: string, message: string): Finding {
    const { input, source } = analysis;
    return {
        check: input.spec.name,
        file: source.path,
        ...positionAt(source.text, statement.start),
        rule,
        message,
        fixable: false,
    };
}

// The findings of one CREATE FUNCTION statement, and whether the function is trivial.
async function functionFindings(
    analysis: Analysis,
    statement: SqlStatementView,
    index: number,
): Promise<{ findings: Finding[]; isTrivial: boolean }> {
    const { threshold, maximum, parsed } = analysis;
    const findings: Finding[] = [];
    const count = inputParameters(statement);
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
async function fileFunctionFindings(analysis: Analysis): Promise<Finding[]> {
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
        const parsed = await sqlFile(source.text, input.observations);
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
        const found = blockCommentAt(source.text);
        if (found === -1) return [];
        return [
            {
                check: input.spec.name,
                file: source.path,
                ...positionAt(source.text, found),
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
    const threshold = input.view.limit('trivial_statements', 'sql') ?? 2;
    const maximum = input.view.limit('function_parameters', 'sql') ?? SHIPPED_PARAMETER_LIMIT;
    for (const source of sources(input)) {
        const parsed = await sqlFile(source.text, input.observations);
        if (parsed.error !== undefined)
            throw new Error(`Cannot analyze SQL functions in ${source.path}: ${parsed.error.text}`);
        findings.push(...(await fileFunctionFindings({ input, source, parsed, threshold, maximum })));
    }
    return findings;
}
