import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { SQL_EXTENSION } from '#cli/config/files/names.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { parseSqlFile } from '#cli/parsers/code/sql/postgres.ts';
import { listCheckFiles } from '#cli/repository/files/selection.ts';
import { MIGRATION_VERSION } from '#cli/config/parsers/code/sql/migrations.ts';
import { type Migration, type MigrationRead } from '#cli/types/checks/postgres.ts';

import {
    SQUAWK_CHECK,
    MIGRATION_DOWN,
    MIGRATION_SYNTAX_SKIP,
    DOWN_MIGRATION_SUFFIX,
} from '#cli/config/checks/database/postgres/migrations.ts';

const MIGRATIONS = { create: () => new Map<string, Promise<Migration[]>>() };

async function parseMigrations(session: Session, paths: Pick<Migration, 'path' | 'version'>[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const { path, version } of paths) {
        const original = readCachedText(session.reads, path);
        // Checks read the forward SQL, without the down section.
        const text = original.split(MIGRATION_DOWN, 1)[0] ?? '';
        const name = posix.basename(path);
        const parsed = await parseSqlFile(text, session.reads);
        migrations.push({
            path,
            name,
            version,
            text,
            statements: parsed.statements,
            ...(parsed.error === undefined ? {} : { error: parsed.error }),
        });
    }
    return migrations;
}

/**
 * Reads and parses the forward migrations of the scope in version order, once for each set of paths.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose migrations to read.
 * @returns the migrations and a finding for each syntax error, both empty when the scope has no migration.
 */
export async function readMigrations(session: Session, planned: PlannedCheck): Promise<MigrationRead> {
    const paths = listMigrationPaths(planned);
    if (paths.length === 0) return { migrations: [], findings: [] };
    const key = JSON.stringify(paths);
    const migrations = await getCachedMapValue(session.reads, MIGRATIONS, key, () =>
        parseMigrations(
            session,
            paths
                .map((path) => ({
                    path,
                    version: MIGRATION_VERSION.exec(posix.basename(path))?.groups?.['version'] ?? '',
                }))
                .toSorted((left, right) => {
                    const first = BigInt(left.version || '0');
                    const second = BigInt(right.version || '0');
                    if (first === second) return left.path.localeCompare(right.path);
                    return first < second ? -1 : 1;
                }),
        ),
    );
    return {
        migrations,
        findings: migrations.flatMap(({ path, error }) =>
            error === undefined
                ? []
                : [buildFinding(planned, { file: path, line: error.line, column: error.column }, 'syntax', error.text)],
        ),
    };
}

/**
 * Lists the forward SQL migrations that the postgres/squawk check covers.
 *
 * @param planned the scope whose files to search.
 * @returns the root-relative paths.
 */
function listMigrationPaths(planned: PlannedCheck): string[] {
    const migrations = listCheckFiles(planned, SQUAWK_CHECK);
    return migrations
        .filter((file) => file.path.endsWith(SQL_EXTENSION) && !file.path.endsWith(DOWN_MIGRATION_SUFFIX))
        .map((file) => file.path);
}

/**
 * Read migrations for semantic checks to inspect.
 *
 * @param session the repository and its tools.
 * @param planned the planned scope and run cache.
 * @returns the migration statements in version order.
 * @throws a skip when the migration-order check owns a syntax failure.
 */
export async function readParsedMigrations(session: Session, planned: PlannedCheck): Promise<Migration[]> {
    const { migrations, findings } = await readMigrations(session, planned);
    if (findings.length > 0) throw new GspotError('skip', MIGRATION_SYNTAX_SKIP);
    return migrations;
}
