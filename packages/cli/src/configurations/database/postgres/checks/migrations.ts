import { posix } from 'node:path';
import { remember } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/tools.ts';
import { listCheckFiles } from '#cli/engine/files.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { readHead, readCommittedTexts } from '#cli/repository/revisions/files.ts';
import type { Migration, MigrationRead } from '#cli/types/configurations/infrastructure.ts';

import {
    parseSqlFile,
    listSqlTokens,
    extractMigrationVersion,
    compareMigrationVersions,
} from '#cli/parsers/code/sql.ts';
import {
    SYNTAX_RULE,
    SQUAWK_CHECK,
    SQL_EXTENSION,
    MIGRATION_DOWN,
    MIGRATION_SYNTAX_SKIP,
    DOWN_MIGRATION_SUFFIX,
} from '#cli/config/configurations/infrastructure.ts';

const MIGRATIONS = Symbol('migrations');

async function parseMigrations(session: Session, paths: Pick<Migration, 'path' | 'version'>[]): Promise<Migration[]> {
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

/**
Reads and parses the forward migrations of the scope in version order, once for each set of paths.

@param session the repository and its tools.
@param planned the scope whose migrations to read.
@returns both empty when the scope has no migration.
*/
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

@param session the repository and its tools.
@param planned the scope whose migrations to read.
@returns the migration statements in version order.
*/
export async function readParsedMigrations(session: Session, planned: PlannedCheck): Promise<Migration[]> {
    const { migrations, findings } = await readMigrations(session, planned);
    if (findings.length > 0) throw new CheckStop('skipped', MIGRATION_SYNTAX_SKIP);
    return migrations;
}

/**
Cut the text at the first MIGRATION_DOWN line outside every string and dollar-quoted body.

@param text the migration SQL.
*/
export function extractForwardText(text: string): string {
    for (const token of listSqlTokens(text)) {
        if (token.kind !== 'line-comment') continue;
        const lineStart = text.lastIndexOf('\n', token.start - 1) + 1;
        if (MIGRATION_DOWN.test(text.slice(lineStart, token.end))) return text.slice(0, lineStart);
    }
    return text;
}

const COMMITTED_MIGRATIONS = Symbol('committed migrations');

/**
Read the committed text of each migration file at a revision. A repository without Git has none.

@param session the repository and its run cache.
@param paths the migration files.
@param revision the commit to read, or `HEAD`.
@returns the text of each file that the revision holds, by path.
*/
export async function readCommittedMigrations(
    session: Session,
    paths: string[],
    revision: string,
): Promise<Map<string, string>> {
    const commit = revision === 'HEAD' ? await readHead(session.root, session.cancelSignal) : revision;
    if (commit === undefined) return new Map<string, string>();
    return remember(session.cache, COMMITTED_MIGRATIONS, `${commit}\0${JSON.stringify(paths)}`, async () =>
        readCommittedTexts(session.root, paths, commit, session.cancelSignal),
    );
}
