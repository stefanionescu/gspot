import { positionAt } from '#cli/text.ts';
import { isRecord } from '#cli/objects.ts';
import { findingAt } from '#cli/checks/finding.ts';
import type { Node, ParseResult } from '@pgsql/types';
import { readSource } from '#cli/system/file-reads.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import type { SqlFile, SqlStatementView } from '#cli/types/parsers/sql.ts';
import { trivialText } from '#cli/checks/general/structure/trivial-functions.ts';
import { PARSED_DIALECT, OUTPUT_PARAMETERS } from '#cli/config/checks/language/sql.ts';
import type { SqlSource, SqlFileInput, SqlFunctionFindings } from '#cli/types/checks/language.ts';
import { nodeOf, nodesOf, walkSqlTree, parseSqlFile, parsePostgres } from '#cli/parsers/sql/postgres.ts';

// Whether a procedural SQL node supplies one executable statement: a statement node other than a block, placed on a line.
function isProceduralStatement(key: string, child: unknown): boolean {
    if (!key.startsWith('PLpgSQL_stmt_') || key === 'PLpgSQL_stmt_block') return false;
    if (!isRecord(child)) return false;
    const line = child['lineno'];
    return typeof line === 'number' && line > 0;
}

function countNodes(value: unknown, isStatement: (key: string, child: unknown) => boolean): number {
    let count = 0;
    walkSqlTree(value, (key, child) => {
        if (isStatement(key, child)) count += 1;
    });
    return count;
}

// The argument of a `CREATE FUNCTION` option, by name.
function functionOption(statement: SqlStatementView<'CreateFunctionStmt'>, name: string): Node | undefined {
    return nodesOf(statement.fields.options, 'DefElem').find((option) => option.defname === name)?.arg;
}

// The executable statements of an SQL function: its standard body, or the string body parsed on its own.
async function sqlBody(statement: SqlStatementView<'CreateFunctionStmt'>): Promise<number> {
    const body = nodeOf(nodeOf(functionOption(statement, 'as'), 'List')?.items?.[0], 'String')?.sval;
    let tree: Node | ParseResult | undefined = statement.fields.sql_body;
    if (body !== undefined) {
        const parsedBody = await parsePostgres(body);
        if ('error' in parsedBody) throw new Error(`Cannot analyze SQL function body: ${parsedBody.error.text}`);
        tree = parsedBody.value;
    }
    return countNodes(tree, (key) => key.endsWith('Stmt'));
}

// The executable statements of a function body, or undefined for a language this check does not read.
async function bodyStatements(
    parsed: SqlFile,
    statement: SqlStatementView<'CreateFunctionStmt'>,
    index: number,
): Promise<number | undefined> {
    const language = nodeOf(functionOption(statement, 'language'), 'String')?.sval;
    if (language === 'plpgsql') {
        const { parsePlPgSQL } = await import('libpg-query');
        const end = parsed.statements[index + 1]?.start ?? parsed.source.length;
        return countNodes(await parsePlPgSQL(parsed.source.slice(statement.start, end)), isProceduralStatement);
    }
    return language === 'sql' ? sqlBody(statement) : undefined;
}

// The findings of one `CREATE FUNCTION` statement, and whether the function counts as trivial.
async function functionFindings(
    analysis: SqlFileInput,
    statement: SqlStatementView<'CreateFunctionStmt'>,
    index: number,
): Promise<SqlFunctionFindings> {
    const { input, source, statementLimit, parameterLimit, parsed } = analysis;
    const at = { file: source.path, ...positionAt(source.text, statement.start) };
    const findings: Finding[] = [];
    const parameters = nodesOf(statement.fields.parameters, 'FunctionParameter');
    const count = parameters.filter(
        (parameter) => parameter.mode === undefined || !OUTPUT_PARAMETERS.has(parameter.mode),
    ).length;
    if (count > parameterLimit)
        findings.push(
            findingAt(
                input,
                at,
                'function-parameters',
                `This function declares ${String(count)} input parameters, over the limit of ${String(parameterLimit)}.`,
            ),
        );
    const statements = await bodyStatements(parsed, statement, index);
    const isTrivial = statements !== undefined && statements <= statementLimit;
    if (isTrivial)
        findings.push(
            findingAt(input, at, 'trivial-function', trivialText('This function', statements, statementLimit)),
        );
    return { findings, isTrivial };
}

// The findings of one file: each function's, then the file's when every statement contains a trivial function.
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
 * Report trivial PostgreSQL functions and excessive declared input parameters.
 * @param input the check input.
 * @returns the findings.
 */
export async function sqlFunctions(input: CheckInput): Promise<Finding[]> {
    const sqlfluff = input.selection.view.options('tools.sqlfluff');
    const dialect = sqlfluff['dialect'];
    if (dialect !== PARSED_DIALECT) return [];
    const findings: Finding[] = [];
    const statementLimit = input.selection.view.limit('min_function_statements', 'sql');
    const parameterLimit = input.selection.view.limit('function_parameters', 'sql');
    for (const file of input.files) {
        const source: SqlSource = {
            path: file.path,
            text: readSource(input.root, file.path, input.reads).toString('utf8'),
        };
        const parsed = await parseSqlFile(source.text, input.reads);
        if (parsed.error !== undefined) continue;
        findings.push(...(await fileFindings({ input, source, parsed, statementLimit, parameterLimit })));
    }
    return findings;
}
