// The statements of one SQL file, each with its kind, its fields and where it starts in the text.
import { memo } from '#cli/platform/memo.ts';
import { parse } from '#cli/parsers/sql/pg.ts';
import { codePoints } from '#cli/platform/text.ts';
import { maskPsqlSyntax } from '#cli/parsers/sql/lexer.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { SqlFile, SqlNode, SqlStatement, SqlStatementView } from '#cli/types/parsers/sql.ts';

const SQL_MEMO = { create: () => new Map<string, Promise<SqlFile>>() };

function statementView(bytes: Buffer, statement: SqlStatement): SqlStatementView {
    const [kind = ''] = Object.keys(statement.stmt);
    const start = bytes.subarray(0, statement.stmt_location ?? 0).toString('utf8').length;
    return { kind, fields: (statement.stmt[kind] ?? {}) as SqlNode, start };
}

/**
 * Parses a file as Postgres reads it.
 * @param text the SQL text
 * @returns the statements, or the parse error with its position
 */
async function parseSqlText(text: string): Promise<SqlFile> {
    const prepared = maskPsqlSyntax(text);
    const source = prepared.text;
    const variables = prepared.variables;
    if (source.trim() === '') return { source, variables, statements: [], error: undefined };
    const parsed = await parse(source);
    const bytes = Buffer.from(source, 'utf8');
    if (parsed.error !== undefined) {
        const offset = codePoints(source).slice(0, parsed.error.offset).join('').length;
        return { source, variables, statements: [], error: { text: parsed.error.text, ...positionAt(text, offset) } };
    }
    const statements = parsed.tree.stmts ?? [];
    return {
        source,
        variables,
        statements: statements.map((statement) => statementView(bytes, statement)),
        error: undefined,
    };
}

/**
 * The line and column of an offset into a text, both from one.
 * @param text the text
 * @param offset the index into it
 * @returns the position
 */
export function positionAt(text: string, offset: number): Pick<NonNullable<SqlFile['error']>, 'line' | 'column'> {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Reuses a PostgreSQL file parse within one source read lifetime.
 * @param text the original SQL, including supported psql syntax
 * @param reads the execution reads, omitted for standalone parsing
 * @returns statements and original diagnostic positions
 */
export function parseSqlFile(text: string, reads?: ReadCache): Promise<SqlFile> {
    if (reads === undefined) return parseSqlText(text);
    const files = memo(reads, SQL_MEMO);
    let parsed = files.get(text);
    if (parsed === undefined) {
        parsed = parseSqlText(text);
        files.set(text, parsed);
    }
    return parsed;
}
