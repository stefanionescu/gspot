import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { CheckInput } from '#cli/types/runs/check.ts';
import { parseSqlFile } from '#cli/parsers/sql/postgres.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';
import { type Migration, type MigrationRead } from '#cli/types/checks/postgres.ts';
import { MIGRATION_DOWN, DOWN_MIGRATION_SUFFIX } from '#cli/config/checks/postgres.ts';

const MIGRATION_MEMO = { create: () => new Map<string, Promise<Migration[]>>() };

async function parseMigrations(input: CheckInput, paths: string[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const path of paths) {
        const original = readCachedBytes(input.reads, path).toString('utf8');
        const text = original.split(MIGRATION_DOWN, 1)[0] ?? '';
        const name = posix.basename(path);
        const parsed = await parseSqlFile(text, input.reads);
        migrations.push({
            path,
            name,
            version: MIGRATION_VERSION.exec(name)?.groups?.['version'] ?? '',
            text,
            statements: parsed.statements,
            ...(parsed.error === undefined ? {} : { error: parsed.error }),
        });
    }
    return migrations;
}

/**
 * Reads and parses every tracked migration in version order.
 *
 * @param input the scope whose migrations to read.
 * @returns the migrations, empty when the repository has no migrations folder.
 */
async function readMigrations(input: CheckInput): Promise<MigrationRead> {
    const paths = listMigrationPaths(input);
    if (paths.length === 0) return { migrations: [], findings: [] };
    const key = JSON.stringify(paths);
    const migrations = await getCachedMapValue(input.reads, MIGRATION_MEMO, key, () =>
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
    return {
        migrations,
        findings: migrations.flatMap(({ path, error }) =>
            error === undefined
                ? []
                : [buildFinding(input, { file: path, line: error.line, column: error.column }, 'syntax', error.text)],
        ),
    };
}

/**
 * Lists the forward SQL migrations that the postgres/squawk check covers.
 *
 * @param input the scope whose files to search.
 * @returns the root-relative paths.
 */
function listMigrationPaths(input: CheckInput): string[] {
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

export { readMigrations };
