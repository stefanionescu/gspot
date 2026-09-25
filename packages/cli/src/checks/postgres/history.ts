import type { EngineInput } from '#cli/checks/input.ts';
import { migrationsOf } from '#cli/checks/postgres/migrations.ts';
import type { Migration } from '#cli/checks/postgres/types.ts';
import type { Finding } from '#cli/checks/result.ts';
import { committedEntries, gitBlobs } from '#cli/repository/revisions/snapshot.ts';

const FROZEN_NONE = 'none';
const FROZEN_ALL = 'all';

function report(input: EngineInput, migration: Migration, rule: string, text: string): Finding {
    return { check: input.spec.name, file: migration.path, line: 1, rule, message: text, fixable: false };
}

const history = new WeakMap<object, Promise<Map<string, string>>>();

async function readCommittedText(input: EngineInput): Promise<Map<string, string>> {
    if (!input.hasGit) return new Map();
    const committed = await committedEntries(input.root, input.cancelSignal);
    const entries = committed.filter(
        (entry) => entry.path.endsWith('.sql') && (entry.mode === '100644' || entry.mode === '100755'),
    );
    const blobs = await gitBlobs(
        input.root,
        entries.map((entry) => entry.object),
        input.cancelSignal,
    );
    return new Map(
        entries.map((entry) => {
            const content = blobs.get(entry.object);
            if (content === undefined) throw new Error('A requested Git blob was not returned.');
            return [entry.path, content.toString('utf8')];
        }),
    );
}

function committedText(input: EngineInput): Promise<Map<string, string>> {
    let observed = history.get(input.observations);
    if (observed === undefined) {
        observed = readCommittedText(input);
        history.set(input.observations, observed);
    }
    return observed;
}

/**
 * One finding for a version two files share, a file with no version, and a new file that sorts before a committed one.
 * @param input the engine input
 * @returns the findings
 */
export async function migrationOrder(input: EngineInput): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    const findings: Finding[] = [];
    const seen = new Map<string, string>();
    for (const migration of migrations) {
        if (migration.version === '')
            findings.push(report(input, migration, 'version', 'The file name starts with no version number.'));
        const earlier = seen.get(migration.version);
        if (earlier !== undefined && migration.version !== '')
            findings.push(
                report(
                    input,
                    migration,
                    'duplicate-version',
                    `${earlier} already has the version ${migration.version}.`,
                ),
            );
        seen.set(migration.version, migration.name);
    }
    const texts = await committedText(input);
    const committed = migrations.filter((migration) => texts.has(migration.path));
    const newest = committed.at(-1);
    if (newest === undefined) return findings;
    const late = migrations.filter((migration) => migration.version < newest.version && !texts.has(migration.path));
    return [
        ...findings,
        ...late.map((migration) =>
            report(
                input,
                migration,
                'order',
                `A new migration sorts before ${newest.name}, which is already committed.`,
            ),
        ),
    ];
}

/**
 * One finding for each migration at or before tools.squawk.frozen_through whose text differs from the committed one.
 * @param input the engine input
 * @returns the findings
 */
export async function migrationsFrozen(input: EngineInput): Promise<Finding[]> {
    const named = input.view.tool('squawk')['frozen_through'];
    const through = typeof named === 'string' ? named : FROZEN_NONE;
    if (through === FROZEN_NONE) return [];
    const migrations = await migrationsOf(input);
    const texts = await committedText(input);
    return migrations
        .filter((migration) => through === FROZEN_ALL || migration.version <= through)
        .flatMap((migration): Finding[] => {
            const committed = texts.get(migration.path);
            if (committed === undefined || committed === migration.text) return [];
            return [
                report(
                    input,
                    migration,
                    'frozen',
                    'This migration has run, and its text changed. Write a new migration.',
                ),
            ];
        });
}
