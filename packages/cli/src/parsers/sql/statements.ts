import { parseSql } from '#cli/parsers/sql/parser.ts';
// The statements of one SQL file, each with its kind, its fields and where it starts in the text.
import { sqlSource } from '#cli/parsers/sql/source.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';
import type { SqlFile, SqlNode, SqlStatement, SqlStatementView } from '#cli/parsers/sql/types.ts';

const observations = new WeakMap<SourceObservations, Map<string, Promise<SqlFile>>>();

function located(bytes: Buffer, statement: SqlStatement): SqlStatementView {
    const [kind = ''] = Object.keys(statement.stmt);
    const start = bytes.subarray(0, statement.stmt_location ?? 0).toString('utf8').length;
    return { kind, fields: (statement.stmt[kind] ?? {}) as SqlNode, start };
}

/**
 * Parses a file as Postgres reads it.
 * @param text the SQL text
 * @returns the statements, or the parse error with its position
 */
async function parseFile(text: string): Promise<SqlFile> {
    const prepared = sqlSource(text);
    const source = prepared.text;
    const variables = prepared.variables;
    if (source.trim() === '') return { source, variables, statements: [], error: undefined };
    const parsed = await parseSql(source);
    const bytes = Buffer.from(source, 'utf8');
    if (parsed.error !== undefined) {
        const offset = [...source].slice(0, parsed.error.offset).join('').length;
        return { source, variables, statements: [], error: { text: parsed.error.text, ...positionAt(text, offset) } };
    }
    const statements = parsed.tree.stmts ?? [];
    return {
        source,
        variables,
        statements: statements.map((statement) => located(bytes, statement)),
        error: undefined,
    };
}

/**
 * The line and column of an offset into a text, both from one.
 * @param text the text
 * @param offset the index into it
 * @returns the position
 */
export function positionAt(text: string, offset: number): { line: number; column: number } {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Reuses a PostgreSQL file parse within one source observation lifetime.
 * @param text the original SQL, including supported psql syntax
 * @param observed the execution observations, omitted for standalone parsing
 * @returns statements and original diagnostic positions
 */
export function sqlFile(text: string, observed?: SourceObservations): Promise<SqlFile> {
    if (observed === undefined) return parseFile(text);
    let files = observations.get(observed);
    if (files === undefined) {
        files = new Map();
        observations.set(observed, files);
    }
    let parsed = files.get(text);
    if (parsed === undefined) {
        parsed = parseFile(text);
        files.set(text, parsed);
    }
    return parsed;
}
