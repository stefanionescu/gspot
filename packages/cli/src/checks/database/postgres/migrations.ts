import { posix } from 'node:path';
import { parseSqlFile } from '#cli/parsers/sql/postgres.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import type { Migration } from '#cli/types/checks/database.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';
import { MIGRATION_DOWN, DOWN_MIGRATION_SUFFIX } from '#cli/config/checks/database.ts';

const MIGRATION_MEMO = { create: () => new Map<string, Promise<Migration[]>>() };

async function parseMigrations(input: CheckInput, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const original = readCachedBytes(input.reads, path).toString('utf8');
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
 * Select forward SQL migration paths from the effective folder or configuration-owned defaults.
 * @param input the input for one scope.
 * @returns root-relative migration paths without parsing their SQL.
 */
function migrationPaths(input: CheckInput): string[] {
    const migrations = input.selection.selected.flatMap((manifest) =>
        manifest.checks
            .filter((check) => check.name === 'postgres/squawk')
            .flatMap((check) =>
                listCoveredFiles(check.files ?? manifest.files, input.files, {
                    selected: input.selection.selected,
                    scope: input.selection.scope.path,
                    view: input.selection.view,
                }),
            ),
    );
    return migrations
        .filter((file) => file.path.endsWith(SQL_EXTENSION) && !file.path.endsWith(DOWN_MIGRATION_SUFFIX))
        .map((file) => file.path);
}

/**
 * Reads and parses every tracked migration in version order.
 * @param input the check input.
 * @returns the migrations, empty when the repository has no migrations folder.
 */
async function readMigrations(input: CheckInput): Promise<Migration[]> {
    const paths = migrationPaths(input);
    if (paths.length === 0) return [];
    const key = JSON.stringify(paths);
    return getCachedMapValue(input.reads, MIGRATION_MEMO, key, () =>
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

export { readMigrations };
