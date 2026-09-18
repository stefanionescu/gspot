// The statements of one SQL file, each with its kind, its fields and where it starts in the text.
import { parseSql } from '#cli/sql/parser.ts';
import type { SqlFile, SqlNode, SqlStatement, SqlStatementView } from '#types/sql.ts';

// The index of the first character after the blank lines and line comments that lead a statement.
function firstKeyword(text: string, start: number): number {
    let index = start;
    while (index < text.length) {
        if (text.startsWith('--', index)) {
            const end = text.indexOf('\n', index);
            index = end === -1 ? text.length : end + 1;
        } else if (text.charAt(index).trim() === '') index += 1;
        else break;
    }
    return index;
}

function located(text: string, bytes: Buffer, statement: SqlStatement): SqlStatementView {
    const [kind = ''] = Object.keys(statement.stmt);
    const start = bytes.subarray(0, statement.stmt_location ?? 0).toString('utf8').length;
    return { kind, fields: (statement.stmt[kind] ?? {}) as SqlNode, start: firstKeyword(text, start) };
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
 * Parses a file as Postgres reads it.
 * @param text the SQL text
 * @returns the statements, or the parse error with its position
 */
export async function sqlFile(text: string): Promise<SqlFile> {
    if (text.trim() === '') return { statements: [], error: undefined };
    const parsed = await parseSql(text);
    const bytes = Buffer.from(text, 'utf8');
    if (parsed.error !== undefined) {
        const offset = bytes.subarray(0, parsed.error.offset).toString('utf8').length;
        return { statements: [], error: { text: parsed.error.text, ...positionAt(text, offset) } };
    }
    const statements = parsed.tree.stmts ?? [];
    return { statements: statements.map((statement) => located(text, bytes, statement)), error: undefined };
}
