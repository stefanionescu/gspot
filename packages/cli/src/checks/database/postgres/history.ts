import { buildFinding } from '#cli/checks/finding.ts';
import { FROZEN_NONE } from '#cli/config/parsers/sql.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { MIGRATION_DOWN } from '#cli/config/checks/database.ts';
import { selectFrozenMigrations } from '#cli/parsers/sql/migrations.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { readBlobs, listHeadEntries } from '#cli/repository/revisions/tree-entries.ts';

const COMMITTED_MIGRATIONS_MEMO = { create: () => new Map<string, Promise<Map<string, string>>>() };

async function readCommittedMigrations(input: CheckInput, paths: string[]): Promise<Map<string, string>> {
    return getCachedMapValue(input.reads, COMMITTED_MIGRATIONS_MEMO, JSON.stringify(paths), async () => {
        if (!input.hasGit) return new Map<string, string>();
        const committed = await listHeadEntries(input.root, input.cancelSignal);
        const selected = new Set(paths);
        const entries = committed.filter(
            (entry) => selected.has(entry.path) && entry.mode !== SYMLINK_MODE && entry.mode !== GITLINK_MODE,
        );
        const blobs = await readBlobs(
            input.root,
            entries.map((entry) => entry.hash),
            input.cancelSignal,
        );
        return new Map(
            entries.map((entry, index) => {
                const content = blobs[index] as Buffer;
                return [entry.path, content.toString('utf8')];
            }),
        );
    });
}

/**
 * Reports a version that two files share, a file with no version, and a new file that sorts before a committed one.
 * @param input the scope whose migrations to compare with the last commit.
 * @returns the findings.
 */
export async function checkPostgresMigrationOrder(input: CheckInput): Promise<Finding[]> {
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
    const findings: Finding[] = [];
    const seen = new Map<string, string>();
    for (const migration of migrations) {
        if (migration.version === '')
            findings.push(
                buildFinding(
                    input,
                    { file: migration.path, line: 1 },
                    'version',
                    'The file name starts with no version number.',
                ),
            );
        const earlier = seen.get(migration.version);
        if (earlier !== undefined && migration.version !== '')
            findings.push(
                buildFinding(
                    input,
                    { file: migration.path, line: 1 },
                    'duplicate-version',
                    `${earlier} already has the version ${migration.version}.`,
                ),
            );
        seen.set(migration.version, migration.name);
    }
    const texts = await readCommittedMigrations(
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
            buildFinding(
                input,
                { file: migration.path, line: 1 },
                'order',
                `A new migration sorts before ${newest.name}, which is already committed.`,
            ),
        ),
    ];
}

/**
 * Reports each migration at or before postgres.frozen_through whose text differs from the committed text.
 * @param input the scope whose migrations to compare with the last commit.
 * @returns the findings.
 */
export async function checkPostgresEditedMigrations(input: CheckInput): Promise<Finding[]> {
    const through = input.selection.view.options('postgres')['frozen_through'];
    if (through === FROZEN_NONE) return [];
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
    const texts = await readCommittedMigrations(
        input,
        migrations.map((migration) => migration.path),
    );
    const frozen = selectFrozenMigrations(
        migrations.map((migration) => migration.path),
        through,
    );
    return migrations
        .filter((migration) => frozen.has(migration.path))
        .flatMap((migration): Finding[] => {
            const committed = texts.get(migration.path);
            if (committed === undefined || (committed.split(MIGRATION_DOWN, 1)[0] ?? '') === migration.text) return [];
            return [
                buildFinding(
                    input,
                    { file: migration.path, line: 1 },
                    'frozen',
                    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.',
                ),
            ];
        });
}
