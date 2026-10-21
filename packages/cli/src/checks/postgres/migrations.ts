import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseSqlFile } from '#cli/parsers/sql/postgres.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { listCheckFiles } from '#cli/repository/covered-files.ts';
import { SQL_EXTENSION, MIGRATION_VERSION } from '#cli/config/parsers/sql.ts';
import { type Migration, type MigrationRead } from '#cli/types/checks/postgres.ts';

import {
    SQUAWK_CHECK,
    MIGRATION_DOWN,
    MIGRATION_SYNTAX_SKIP,
    DOWN_MIGRATION_SUFFIX,
} from '#cli/config/checks/postgres.ts';

const MIGRATIONS = { create: () => new Map<string, Promise<Migration[]>>() };

async function parseMigrations(session: Session, paths: Pick<Migration, 'path' | 'version'>[]): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const { path, version } of paths) {
        const original = readCachedText(session.reads, path);
        const text = stripDownSection(original);
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
 * Reads and parses every tracked migration in version order.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose migrations to read.
 * @returns the migrations, empty when the repository has no migrations folder.
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

/**
 * Strip the down section before migration checks inspect the forward SQL.
 *
 * @param text the full migration source.
 * @returns the forward section.
 */
export function stripDownSection(text: string): string {
    return text.split(MIGRATION_DOWN, 1)[0] ?? '';
}
