// A parsed migration file for the tests of the Postgres checks.
import { sqlFile } from '#cli/parsers/sql/statements.ts';
import type { Migration } from '#cli/types/checks/database.ts';

/**
 * A migration under migrations/, parsed.
 * @param name the file name
 * @param text the SQL
 * @param version the version the name carries; its first character unless given
 * @returns the migration
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Nine cases across the two Postgres test files parse a migration this way.
export async function migration(name: string, text: string, version = name.slice(0, 1)): Promise<Migration> {
    const parsed = await sqlFile(text);
    return { path: `migrations/${name}`, name, version, text, statements: parsed.statements };
}
