import { posix } from 'node:path';

import {
    DOWN_MIGRATION_SUFFIX,
    MIGRATION_DOWN,
    MIGRATION_SYNTAX_SKIP,
    SQL_EXTENSION,
    SQUAWK_CHECK,
    SYNTAX_RULE,
} from '#cli/config/configurations/infrastructure.ts';
import { listCheckFiles } from '#cli/engine/files.ts';
import {
    compareMigrationVersions,
    extractMigrationVersion,
    listSqlTokens,
    parseSqlFile,
} from '#cli/parsers/code/sql.ts';
import { readCommittedTexts, readHead } from '#cli/repository/revisions/files.ts';
import { remember } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import type { Migration, MigrationRead } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
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
