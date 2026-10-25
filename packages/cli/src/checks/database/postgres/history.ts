import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { FROZEN_NONE } from '#cli/config/parsers/code/sql.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { selectFrozenMigrations } from '#cli/parsers/code/sql.ts';
import { SYMLINK_MODE, GITLINK_MODE } from '#cli/config/files/modes.ts';
import { readHead, readBlobs, listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { readMigrations, readForwardText, readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';

const COMMITTED_MIGRATIONS = { create: () => new Map<string, Promise<Map<string, string>>>() };

async function readCommittedMigrations(
    session: Session,
    paths: string[],
    revision: string,
): Promise<Map<string, string>> {
    if (!session.repository.hasGit) return new Map<string, string>();
    const commit = revision === 'HEAD' ? await readHead(session.root, session.cancelSignal) : revision;
    if (commit === undefined) return new Map<string, string>();
    return getCachedMapValue(session.reads, COMMITTED_MIGRATIONS, `${commit}\0${JSON.stringify(paths)}`, async () => {
        const committed = await listRevisionFiles(session.root, { kind: 'commit', hash: commit }, session.cancelSignal);
        const selected = new Set(paths);
        const files = committed.filter(
            (file) => selected.has(file.path) && file.mode !== SYMLINK_MODE && file.mode !== GITLINK_MODE,
        );
        const blobs = await readBlobs(
            session.root,
            files.map((file) => file.hash),
            session.cancelSignal,
        );
        return new Map(
            files.map((file, index) => {
                const content = blobs[index] as Buffer;
                return [file.path, content.toString('utf8')];
            }),
        );
    });
}

/**
Reports a version that two files share, a file with no version, and a new file that sorts before a committed one.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
@returns the findings.
*/
export async function checkPostgresMigrationOrder(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(session, planned);
    if (syntax.length > 0) return syntax;
    const findings: Finding[] = [];
    const seen = new Map<string, string>();
    for (const migration of migrations) {
        if (migration.version === '')
            findings.push(
                buildFinding(
                    planned,
                    { file: migration.path, line: 1 },
                    'version',
                    'The file name starts with no version number.',
                ),
            );
        const earlier = seen.get(migration.version);
        if (earlier !== undefined && migration.version !== '')
            findings.push(
                buildFinding(
                    planned,
                    { file: migration.path, line: 1 },
                    'duplicate-version',
                    `${earlier} already has the version ${migration.version}.`,
                ),
            );
        seen.set(migration.version, migration.name);
    }
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        planned.base ?? 'HEAD',
    );
    const committed = migrations.filter((migration) => texts.has(migration.path));
    const newest = committed.at(-1);
    if (newest === undefined) return findings;
    const late = migrations.filter(
        (migration) =>
            migration.version !== '' &&
            newest.version !== '' &&
            BigInt(migration.version) < BigInt(newest.version) &&
            !texts.has(migration.path),
    );
    return [
        ...findings,
        ...late.map((migration) =>
            buildFinding(
                planned,
                { file: migration.path, line: 1 },
                'order',
                `A new migration sorts before ${newest.name}, which is already committed.`,
            ),
        ),
    ];
}

/**
Reports each migration at or before postgres.frozen_through whose text differs from the committed text.

@param session the repository and its tools.
@param planned the scope whose migrations to compare with the last commit.
@returns the findings.
*/
export async function checkPostgresEditedMigrations(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const through = getTable(planned.scope.settings, 'postgres')['frozen_through'];
    if (through === FROZEN_NONE) return [];
    const migrations = await readParsedMigrations(session, planned);
    const texts = await readCommittedMigrations(
        session,
        migrations.map((migration) => migration.path),
        planned.base ?? 'HEAD',
    );
    const frozen = selectFrozenMigrations(
        migrations.map((migration) => migration.path),
        through,
    );
    return migrations
        .filter((migration) => frozen.has(migration.path))
        .flatMap((migration): Finding[] => {
            const committed = texts.get(migration.path);
            if (committed === undefined || readForwardText(committed) === migration.text) return [];
            return [
                buildFinding(
                    planned,
                    { file: migration.path, line: 1 },
                    'frozen',
                    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.',
                ),
            ];
        });
}
