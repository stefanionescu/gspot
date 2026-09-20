// The history of the migrations folder: versions that never repeat, new files that sort last, and old files that never change.
import { git } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { Migration } from '#types/postgres.ts';
import { migrationsOf } from '#cli/postgres/migrations.ts';

const FROZEN_NONE = 'none';
const FROZEN_ALL = 'all';

function report(input: EngineInput, migration: Migration, rule: string, text: string): Finding {
    return { check: input.spec.name, file: migration.path, line: 1, rule, message: text, fixable: false };
}

function committedText(input: EngineInput, path: string): string | undefined {
    return git(input.root, ['show', `HEAD:${path}`]);
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
    const committed = migrations.filter((migration) => committedText(input, migration.path) !== undefined);
    const newest = committed.at(-1);
    if (newest === undefined) return findings;
    const late = migrations.filter(
        (migration) => migration.version < newest.version && committedText(input, migration.path) === undefined,
    );
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
    return migrations
        .filter((migration) => through === FROZEN_ALL || migration.version <= through)
        .flatMap((migration): Finding[] => {
            const committed = committedText(input, migration.path);
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
