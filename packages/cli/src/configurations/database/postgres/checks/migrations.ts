import { posix } from 'node:path';

import {
    DOWN_MIGRATION_SUFFIX,
    MIGRATION_DOWN,
    MIGRATION_SYNTAX_SKIP,
    MIGRATION_VERSION,
    PRISMA_MIGRATION_FILE,
    SQUAWK_CHECK,
} from '#cli/config/configurations/postgres.ts';
import { SQL_EXTENSION, SYNTAX_RULE } from '#cli/config/configurations/shared.ts';
import { FROZEN_ALL, FROZEN_NONE } from '#cli/config/settings/schema.ts';
import { listCheckFiles } from '#cli/engine/files.ts';
import { listSqlTokens, parseSqlFile } from '#cli/parsers/code/sql.ts';
import { readCommittedTexts, readHead } from '#cli/repository/revisions/files.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import type { Migration, MigrationRead } from '#cli/types/configurations/database.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

const MIGRATIONS = Symbol('migrations');

async function parseMigrations(
    session: Session,
    paths: Array<Pick<Migration, 'path' | 'version'>>,
): Promise<Migration[]> {
    const migrations: Migration[] = [];
    for (const { path, version } of paths) {
        const text = extractForwardText(readText(session.cache, path));
        const name = posix.basename(path);
        const parsed = await parseSqlFile(text, session.cache);
        migrations.push({
            path,
            name,
            version,
            text,
            statements: parsed.statements,
            ...(parsed.error !== undefined && { error: parsed.error }),
        });
    }
    return migrations;
}

function listMigrationPaths(planned: PlannedCheck): string[] {
    const migrations = listCheckFiles(planned, SQUAWK_CHECK);
    return migrations
        .filter((file) => file.path.endsWith(SQL_EXTENSION) && !file.path.endsWith(DOWN_MIGRATION_SUFFIX))
        .map((file) => file.path);
}

function extractMigrationVersion(path: string): string | undefined {
    const name = posix.basename(path);
    const versioned = name === PRISMA_MIGRATION_FILE ? posix.basename(posix.dirname(path)) : name;
    return MIGRATION_VERSION.exec(versioned)?.groups?.['version']?.replaceAll('_', '.');
}

export async function readMigrations(session: Session, planned: PlannedCheck): Promise<MigrationRead> {
    const paths = listMigrationPaths(planned);
    if (paths.length === 0) return { migrations: [], findings: [] };
    const key = JSON.stringify(paths);
    const migrations = await remember(session.cache, MIGRATIONS, key, () =>
        parseMigrations(
            session,
            paths
                .map((path) => ({
                    path,
                    version: extractMigrationVersion(path) ?? '',
                }))
                .toSorted((left, right) => {
                    return compareMigrationVersions(left.version, right.version) || compareText(left.path, right.path);
                }),
        ),
    );
    return {
        migrations,
        findings: migrations.flatMap(({ path, error }) =>
            error === undefined
                ? []
                : [
                      {
                          file: path,
                          line: error.line,
                          column: error.column,
                          rule: SYNTAX_RULE,
                          message: error.text,
                      },
                  ],
        ),
    };
}

/**
Skip the check when a migration does not parse, which postgres/migration-order reports.
*/
export async function readParsedMigrations(session: Session, planned: PlannedCheck): Promise<Migration[]> {
    const { migrations, findings } = await readMigrations(session, planned);
    if (findings.length > 0) throw new CheckStop('skipped', MIGRATION_SYNTAX_SKIP);
    return migrations;
}

export function compareMigrationVersions(left: string, right: string): number {
    const first = left.replaceAll('_', '.').split('.');
    const second = right.replaceAll('_', '.').split('.');
    for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
        const before = BigInt(first[index] ?? '0');
        const after = BigInt(second[index] ?? '0');
        if (before !== after) return before < after ? -1 : 1;
    }
    return 0;
}

export function selectFrozenMigrations(paths: string[], through: string): Set<string> {
    if (through === FROZEN_NONE) return new Set();
    const cutoff = MIGRATION_VERSION.exec(through)?.groups?.['version'];
    return new Set(
        paths.filter((path) => {
            const version = extractMigrationVersion(path);
            return (
                through === FROZEN_ALL ||
                (version !== undefined && cutoff !== undefined && compareMigrationVersions(version, cutoff) <= 0)
            );
        }),
    );
}

export function listUnfrozenMigrations(migrations: Migration[], planned: PlannedCheck): Migration[] {
    const frozen = selectFrozenMigrations(
        migrations.map(({ path }) => path),
        getTable(planned.scope.settings, 'postgres').frozen_through,
    );
    return migrations.filter(({ path }) => !frozen.has(path));
}

export function extractForwardText(text: string): string {
    for (const token of listSqlTokens(text)) {
        if (token.kind !== 'line-comment') continue;
        const lineStart = text.lastIndexOf('\n', token.start - 1) + 1;
        if (MIGRATION_DOWN.test(text.slice(lineStart, token.end))) return text.slice(0, lineStart);
    }
    return text;
}

const COMMITTED_MIGRATIONS = Symbol('committed migrations');

export async function readCommittedMigrations(
    session: CheckSession,
    migrations: Migration[],
): Promise<Map<string, string>> {
    const paths = migrations.map((migration) => migration.path);
    const revision = session.selection?.base ?? 'HEAD';
    const commit = revision === 'HEAD' ? await readHead(session.root, session.cancelSignal) : revision;
    if (commit === undefined) return new Map<string, string>();
    return remember(session.cache, COMMITTED_MIGRATIONS, `${commit}\0${JSON.stringify(paths)}`, async () =>
        readCommittedTexts(session.root, paths, commit, session.cancelSignal),
    );
}
