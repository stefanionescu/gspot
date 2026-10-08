// A parsed migration file for the tests of the Postgres checks.
import { parseSqlFile } from '#cli/parsers/sql/public.ts';
import type { Migration } from '#cli/types/checks/postgres.ts';

/**
 * A migration under migrations/, parsed.
 * @param name the file name
 * @param text the SQL
 * @param version the version the name carries; its first character unless given
 * @returns the migration
 */

export async function parseMigration(name: string, text: string, version = name.slice(0, 1)): Promise<Migration> {
    const parsed = await parseSqlFile(text);
    return { path: `migrations/${name}`, name, version, text, statements: parsed.statements };
}
