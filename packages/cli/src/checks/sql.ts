import { parsePlpgsql } from '#cli/readers/sql/parser.ts';
// The checks every SQL file gets: it parses, it holds no block comment, and it stays under the line ceiling.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { positionAt, sqlFile } from '#cli/readers/sql/statements.ts';

const POSTGRES_DIALECTS = new Set(['postgres', 'ansi']);
const BLOCK_COMMENT = '/*';
const LINE_COMMENT = '--';
// :'name' and :"name" are quoted psql variables; :name after a space, a bracket, a comma or an equals sign is a plain one.
const PSQL_QUOTED = /:'[A-Za-z_]\w*'|:"[A-Za-z_]\w*"/gu;
const PSQL_NAMED = /(?<lead>[\s(,=]):[A-Za-z_]\w*/gu;
// A string, a quoted name, a line comment, or the start of a block comment, whichever comes first.
const SQL_TOKENS = /'[^']*'|"[^"]*"|--[^\n]*|\/\*/gu;

function sources(input: EngineInput): { path: string; text: string }[] {
    return input.files
        .filter((file) => file.nature === 'source')
        .map((file) => ({ path: file.path, text: readFileSync(join(input.root, file.path), 'utf8') }));
}

// A script for psql holds meta-commands and variables the server never sees. A meta-command line becomes blank and a
// variable becomes a literal or a name of the same length class, so the parser reads what the server reads and lines keep their numbers.
function withoutPsql(text: string): string {
    return text
        .split('\n')
        .map((line) => (line.trimStart().startsWith('\\') ? '' : line))
        .join('\n')
        .replaceAll(PSQL_QUOTED, "''")
        .replaceAll(PSQL_NAMED, (_match, lead: string) => `${lead}psql_variable`);
}

// The index of the first block comment outside a string and outside a line comment, or a negative number.
function blockCommentAt(text: string): number {
    const found = text.matchAll(SQL_TOKENS).find((match) => match[0] === BLOCK_COMMENT);
    return found?.index ?? -1;
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
        const parsed = await sqlFile(withoutPsql(source.text));
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
export function sqlBlockComments(input: EngineInput): Promise<Finding[]> {
    const findings = sources(input).flatMap((source): Finding[] => {
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
    return Promise.resolve(findings);
}

/**
 * One finding for each file with more code lines than limits.sql.file_lines.
 * @param input the engine input
 * @returns the findings
 */
export function sqlFileLength(input: EngineInput): Promise<Finding[]> {
    const ceiling = input.view.limit('file_lines', 'sql');
    if (ceiling === undefined) return Promise.resolve([]);
    const findings = sources(input).flatMap((source): Finding[] => {
        const lines = source.text.split('\n').map((line) => line.trim());
        const count = lines.filter((line) => line !== '' && !line.startsWith(LINE_COMMENT)).length;
        if (count <= ceiling) return [];
        const said = `${String(count)} code lines is over the ceiling of ${String(ceiling)}.`;
        return [
            { check: input.spec.name, file: source.path, line: 1, rule: 'file-lines', message: said, fixable: false },
        ];
    });
    return Promise.resolve(findings);
}

function proceduralStatements(value: unknown): number {
    if (value === null || typeof value !== 'object') return 0;
    if (Array.isArray(value)) return value.reduce<number>((count, child) => count + proceduralStatements(child), 0);
    let count = 0;
    for (const [key, child] of Object.entries(value)) {
        if (
            key.startsWith('PLpgSQL_stmt_') &&
            key !== 'PLpgSQL_stmt_block' &&
            ((child as { lineno?: number }).lineno ?? 0) > 0
        )
            count += 1;
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

/** Check implemented PostgreSQL functions and their declared input parameters. */
export async function sqlFunctions(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    const threshold = input.view.limit('trivial_statements', 'sql') ?? 2;
    const maximum = input.view.limit('function_parameters', 'sql') ?? 7;
    for (const source of sources(input)) {
        const parsed = await sqlFile(source.text);
        if (parsed.error !== undefined)
            throw new Error(`Cannot analyze SQL functions in ${source.path}: ${parsed.error.text}`);
        let trivial = 0;
        for (const [index, statement] of parsed.statements.entries()) {
            if (statement.kind !== 'CreateFunctionStmt') continue;
            const parameters = (statement.fields['parameters'] ?? []) as { FunctionParameter: { mode: string } }[];
            const count = parameters.filter(
                ({ FunctionParameter: parameter }) => !['FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE'].includes(parameter.mode),
            ).length;
            if (count > maximum)
                findings.push({
                    check: input.spec.name,
                    file: source.path,
                    ...positionAt(source.text, statement.start),
                    rule: 'function-parameters',
                    message: `${count} declared input parameters exceeds ${maximum}.`,
                    fixable: false,
                });
            const options = (statement.fields['options'] ?? []) as {
                DefElem: {
                    defname: string;
                    arg: { String?: { sval: string }; List?: { items: { String: { sval: string } }[] } };
                };
            }[];
            const language = options.find(({ DefElem }) => DefElem.defname === 'language')?.DefElem.arg.String?.sval;
            const body = options.find(({ DefElem }) => DefElem.defname === 'as')?.DefElem.arg.List?.items[0]?.String
                .sval;
            let statements: number;
            if (language === 'plpgsql') {
                const definition = source.text.slice(statement.start, parsed.statements[index + 1]?.start);
                statements = proceduralStatements(await parsePlpgsql(definition));
            } else if (language === 'sql') {
                if (body !== undefined) {
                    const parsedBody = await sqlFile(body);
                    if (parsedBody.error !== undefined)
                        throw new Error(`Cannot analyze SQL function body: ${parsedBody.error.text}`);
                    statements = parsedBody.statements.reduce(
                        (count, statement) => count + 1 + sqlStatements(statement.fields),
                        0,
                    );
                } else {
                    statements = sqlStatements(statement.fields['sql_body']);
                }
            } else continue;
            if (statements <= threshold) {
                trivial += 1;
                findings.push({
                    check: input.spec.name,
                    file: source.path,
                    ...positionAt(source.text, statement.start),
                    rule: 'trivial-function',
                    message: `This function has ${statements} executable statements, at most ${threshold}. Inline it or suppress its required API with a reason.`,
                    fixable: false,
                });
            }
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
    }
    return findings;
}
