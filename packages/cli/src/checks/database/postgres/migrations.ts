import { posix } from 'node:path';
import { coveredBy } from '#cli/repository/select.ts';
import { parseSqlFile } from '#cli/parsers/sql/postgres.ts';
import { MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';
import type { Migration } from '#cli/types/checks/database.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { memoized, readSource } from '#cli/system/file-reads.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';
import { MIGRATION_DOWN, DOWN_MIGRATION_SUFFIX, POSTGRES_CONFIGURATION } from '#cli/config/checks/database.ts';

const MIGRATION_MEMO = { create: () => new Map<string, Promise<Migration[]>>() };

async function parseMigrations(input: CheckInput, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const original = readSource(input.root, path, input.reads).toString('utf8');
        const text = original.split(MIGRATION_DOWN, 1)[0] ?? '';
        const name = posix.basename(path);
        const parsed = await parseSqlFile(text, input.reads);
        if (parsed.error !== undefined)
            throw new Error(
                `${path}:${String(parsed.error.line)}:${String(parsed.error.column)}: the SQL does not parse: ${parsed.error.text}`,
            );
        migrations.push({
            path,
            name,
            version: MIGRATION_VERSION.exec(name)?.groups?.['version'] ?? '',
            text,
            statements: parsed.statements,
        });
    }
    return migrations;
}

/**
 * Reads and parses every tracked migration in version order.
 * @param input the check input.
 * @returns the migrations, empty when the repository has no migrations folder.
 */
export async function readMigrations(input: CheckInput): Promise<Migration[]> {
    const paths = migrationPaths(input);
    if (paths.length === 0) return [];
    const key = JSON.stringify(paths);
    return memoized(input.reads, MIGRATION_MEMO, key, () =>
        parseMigrations(
            input,
            paths
                .map((path) => ({
                    path,
                    version: BigInt(MIGRATION_VERSION.exec(posix.basename(path))?.groups?.['version'] ?? '0'),
                }))
                .toSorted((left, right) => {
                    if (left.version === right.version) return left.path.localeCompare(right.path);
                    return left.version < right.version ? -1 : 1;
                })
                .map((entry) => entry.path),
        ),
    );
}

/**
 * Select forward SQL migration paths from the effective folder or configuration-owned defaults.
 * @param input the input for one scope.
 * @returns root-relative migration paths without parsing their SQL.
 */
export function migrationPaths(input: CheckInput): string[] {
    const folder = input.selection.view.options('postgres').migrations_folder;
    const migrations =
        folder === undefined
            ? input.selection.selected.flatMap((manifest) =>
                  manifest.configuration.name === POSTGRES_CONFIGURATION
                      ? coveredBy(
                            manifest.files,
                            input.selection.selected,
                            input.files,
                            input.selection.scope.path,
                            input.selection.view.test_files,
                            input.selection.view.settings,
                        )
                      : [],
              )
            : input.files.filter((file) => file.path.startsWith(`${folder}/`));
    return migrations
        .filter((file) => file.path.endsWith(SQL_EXTENSION) && !file.path.endsWith(DOWN_MIGRATION_SUFFIX))
        .map((file) => file.path);
}
