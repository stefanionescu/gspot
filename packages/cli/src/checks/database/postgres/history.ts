import { memo } from '#cli/platform/memo.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { FROZEN_NONE } from '#cli/config/parsers/sql.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { MIGRATION_DOWN } from '#cli/config/checks/postgres.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { frozenMigrationPaths } from '#cli/parsers/sql/migrations.ts';
import { migrationsOf } from '#cli/checks/database/postgres/public.ts';
import { getBlobs, getHeadEntries } from '#cli/repository/revisions/public.ts';
import { GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';

const COMMITTED_MIGRATIONS_MEMO = { create: () => new Map<string, Promise<Map<string, string>>>() };

async function readCommittedMigrations(input: CheckInput, paths: string[]): Promise<Map<string, string>> {
    if (!input.hasGit) return new Map();
    const committed = await getHeadEntries(input.root, input.cancelSignal);
    const selected = new Set(paths);
    const entries = committed.filter(
        (entry) => selected.has(entry.path) && entry.mode !== SYMLINK_MODE && entry.mode !== GITLINK_MODE,
    );
    const blobs = await getBlobs(
        input.root,
        entries.map((entry) => entry.hash),
        input.cancelSignal,
    );
    return new Map(
        entries.map((entry) => {
            const content = blobs.get(entry.hash);
            if (content === undefined) throw new Error('A requested Git blob was not returned.');
            return [entry.path, content.toString('utf8')];
        }),
    );
}

function committedMigrationTexts(input: CheckInput, paths: string[]): Promise<Map<string, string>> {
    const committedMigrations = memo(input.reads, COMMITTED_MIGRATIONS_MEMO);
    const key = JSON.stringify(paths);
    let read = committedMigrations.get(key);
    if (read === undefined) {
        read = readCommittedMigrations(input, paths);
        committedMigrations.set(key, read);
    }
    return read;
}

/**
 * One finding for a version two files share, a file with no version, and a new file that sorts before a committed one.
 * @param input the check input
 * @returns the findings
 */
export async function migrationOrder(input: CheckInput): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    const findings: Finding[] = [];
    const seen = new Map<string, string>();
    for (const migration of migrations) {
        if (migration.version === '')
            findings.push(
                findingAt(
                    input,
                    { file: migration.path, line: 1 },
                    'version',
                    'The file name starts with no version number.',
                ),
            );
        const earlier = seen.get(migration.version);
        if (earlier !== undefined && migration.version !== '')
            findings.push(
                findingAt(
                    input,
                    { file: migration.path, line: 1 },
                    'duplicate-version',
                    `${earlier} already has the version ${migration.version}.`,
                ),
            );
        seen.set(migration.version, migration.name);
    }
    const texts = await committedMigrationTexts(
        input,
        migrations.map((migration) => migration.path),
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
            findingAt(
                input,
                { file: migration.path, line: 1 },
                'order',
                `A new migration sorts before ${newest.name}, which is already committed.`,
            ),
        ),
    ];
}

/**
 * One finding for each migration at or before postgres.frozen_through whose text differs from the committed one.
 * @param input the check input
 * @returns the findings
 */
export async function migrationsFrozen(input: CheckInput): Promise<Finding[]> {
    const through = input.view.options('postgres')['frozen_through'];
    if (through === FROZEN_NONE) return [];
    const migrations = await migrationsOf(input);
    const texts = await committedMigrationTexts(
        input,
        migrations.map((migration) => migration.path),
    );
    const frozen = frozenMigrationPaths(
        migrations.map((migration) => migration.path),
        through,
    );
    return migrations
        .filter((migration) => frozen.has(migration.path))
        .flatMap((migration): Finding[] => {
            const committed = texts.get(migration.path);
            if (committed === undefined || (committed.split(MIGRATION_DOWN, 1)[0] ?? '') === migration.text) return [];
            return [
                findingAt(
                    input,
                    { file: migration.path, line: 1 },
                    'frozen',
                    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.',
                ),
            ];
        });
}
