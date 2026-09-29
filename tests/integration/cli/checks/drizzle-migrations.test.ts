import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { drizzleMigrations } from '#cli/checks/drizzle.ts';
import { rejection } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import type { DrizzlePlanted as Planted } from '#tests/types/integration/cli/checks.ts';
import { statSync, chmodSync, mkdirSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { DRIZZLE_MIGRATIONS_SCOPES, DRIZZLE_MIGRATIONS_GENERATOR } from '#tests/inputs/integration/cli/checks.ts';

// A planted scope with a generator script that stands in for drizzle-kit: `schema.txt` decides what it does.
async function plant(scope: string, schema: 'changed' | 'failure'): Promise<Planted> {
    const directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['drizzle']) + (scope === '' ? '' : `[[scope]]\npath = "${scope}"\nkits = []\n`),
        [join(scope, 'package.json')]: '{"private":true}\n',
        [join(scope, 'drizzle.config.ts')]: 'export default {};\n',
        [join(scope, 'schema.txt')]: schema,
        [join(scope, 'generate')]: DRIZZLE_MIGRATIONS_GENERATOR,
        [join(scope, 'migrations/0000_initial.sql')]: 'CREATE TABLE records (id int);\n',
        [join(scope, 'migrations/meta/log.json')]: '{"version":1}\n',
        'unrelated/keep.sql': '-- Keep another scope\n',
    });
    commitAll(directory.path);
    const manual = join(directory.path, join(scope, 'migrations/0009_manual.sql'));
    writeFileSync(manual, '-- Preserve manual migration\n');
    chmodSync(manual, 0o640);
    const initial = join(directory.path, join(scope, 'migrations/0000_initial.sql'));
    writeFileSync(initial, '-- Developer edit\n');
    const bin = join(directory.path, 'node_modules/.bin');
    mkdirSync(bin, { recursive: true });
    symlinkSync(process.execPath, join(bin, process.platform === 'win32' ? 'drizzle-kit.exe' : 'drizzle-kit'), 'file');
    const session = await openSession(directory.path);
    const spec = session.manifests.get('drizzle')!.checks.find((entry) => entry.analysis === 'drizzle-migrations')!;
    const planned = planRun(session, { stage: 'push', skips: [], only: [spec.name] });
    const input = engineInput(session, planned.find((entry) => entry.scope.scope.path === scope)!);
    return {
        directory,
        path: (file: string) => join(scope, file),
        manual,
        mode: statSync(manual).mode,
        initial,
        spec,
        input,
    };
}

// Whatever the generator did, the tracked edits, the untracked migration, and the other scope are untouched.
function expectPreserved({ directory, path, manual, mode, initial }: Planted): void {
    expect(readFileSync(manual, 'utf8')).toBe('-- Preserve manual migration\n');
    expect(statSync(manual).mode).toBe(mode);
    expect(readFileSync(initial, 'utf8')).toBe('-- Developer edit\n');
    expect(readFileSync(join(directory.path, path('migrations/meta/log.json')), 'utf8')).toBe('{"version":1}\n');
    expect(readFileSync(join(directory.path, 'unrelated/keep.sql'), 'utf8')).toBe('-- Keep another scope\n');
}

test.each(DRIZZLE_MIGRATIONS_SCOPES)(
    'a failed generation in %s reports the failure and preserves every file',
    async (scope) => {
        const planted = await plant(scope, 'failure');
        await using directory = planted.directory;
        const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
        try {
            expect(await rejection(drizzleMigrations(planted.input))).toContain('Migration generation failed');
            writeFileSync(join(directory.path, planted.path('schema.txt')), 'current');
            expect(await drizzleMigrations(planted.input)).toStrictEqual([]);
            expectPreserved(planted);
        } finally {
            locate.mockRestore();
        }
    },
);

test.each(DRIZZLE_MIGRATIONS_SCOPES)(
    'a stale schema in %s reports the missing migration files and preserves every file',
    async (scope) => {
        const planted = await plant(scope, 'changed');
        await using directory = planted.directory;
        const locate = spyOn(Bun, 'which').mockReturnValue(process.execPath);
        try {
            const found = await drizzleMigrations(planted.input);
            expect(found.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
                {
                    check: planted.spec.name,
                    file: toPosix(planted.path('migrations/0001_change.sql')),
                    rule: 'missing-migration',
                },
                {
                    check: planted.spec.name,
                    file: toPosix(planted.path('migrations/meta/log.json')),
                    rule: 'missing-migration',
                },
            ]);
            expect(
                found.every(
                    (entry) =>
                        entry.message ===
                        'drizzle-kit changes this file when generating migrations; regenerate and commit the migration output.',
                ),
            ).toBe(true);
            writeFileSync(join(directory.path, planted.path('schema.txt')), 'current');
            expect(await drizzleMigrations(planted.input)).toStrictEqual([]);
            expectPreserved(planted);
        } finally {
            locate.mockRestore();
        }
    },
);
