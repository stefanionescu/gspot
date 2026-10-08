import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { rejection, containing } from '#tests/harness/expectations.ts';
import { relations, migrations } from '#cli/checks/library/drizzle.ts';
import type { MigrationProject } from '#tests/types/cli/checks/library/drizzle.ts';
import { stat, chmod, mkdir, symlink, readFile, writeFile } from 'node:fs/promises';

import {
    DRIZZLE_RELATIONS_CASES,
    DRIZZLE_MIGRATIONS_SCOPES,
    DRIZZLE_MIGRATIONS_GENERATOR,
} from '#tests/config/cli/checks/library/drizzle.ts';

// A test scope with a generator script that stands in for drizzle-kit: `schema.txt` decides what it does.
async function applyChanges(scope: string, schema: 'changed' | 'failure'): Promise<MigrationProject> {
    const directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['drizzle']) + (scope === '' ? '' : `[scope."${scope}"]\nconfigurations = []\n`),
        [join(scope, 'package.json')]: '{"private":true}\n',
        [join(scope, 'drizzle.config.ts')]: 'export default {};\n',
        [join(scope, 'schema.txt')]: schema,
        [join(scope, 'generate')]: DRIZZLE_MIGRATIONS_GENERATOR,
        [join(scope, 'migrations/0000_initial.sql')]: 'CREATE TABLE records (id int);\n',
        [join(scope, 'migrations/meta/log.json')]: '{"version":1}\n',
        [join(scope, 'migrations/.meta/state.json')]: '{"version":1}\n',
        'unrelated/keep.sql': '-- Keep another scope\n',
    });
    commitAll(directory.path);
    const manual = join(directory.path, join(scope, 'migrations/0009_manual.sql'));
    await writeFile(manual, '-- Preserve manual migration\n');
    await chmod(manual, 0o640);
    const initial = join(directory.path, join(scope, 'migrations/0000_initial.sql'));
    await writeFile(initial, '-- Developer edit\n');
    const bin = join(directory.path, 'node_modules/.bin');
    await mkdir(bin, { recursive: true });
    await symlink(
        process.execPath,
        join(bin, process.platform === 'win32' ? 'drizzle-kit.exe' : 'drizzle-kit'),
        'file',
    );
    const session = await openSession(directory.path);
    const check = session.manifests.get('drizzle')!.checks.find((entry) => entry.name === 'drizzle/migrations-fresh')!;
    const planned = planRun(session, { stage: 'push', skips: [], only: [check.name] });
    const input = checkInput(session, planned.find((entry) => entry.scope.scope.path === scope)!);
    const { mode } = await stat(manual);
    return {
        directory,
        path: (file: string) => join(scope, file),
        manual,
        mode,
        initial,
        check,
        input,
    };
}

// Whatever the generator did, the tracked edits, the untracked migration, and the other scope are untouched.
async function expectPreserved({ directory, path, manual, mode, initial }: MigrationProject): Promise<void> {
    expect(await readFile(manual, 'utf8')).toBe('-- Preserve manual migration\n');
    const current = await stat(manual);
    expect(current.mode).toBe(mode);
    expect(await readFile(initial, 'utf8')).toBe('-- Developer edit\n');
    expect(await readFile(join(directory.path, path('migrations/meta/log.json')), 'utf8')).toBe('{"version":1}\n');
    expect(await readFile(join(directory.path, path('migrations/.meta/state.json')), 'utf8')).toBe('{"version":1}\n');
    expect(await readFile(join(directory.path, 'unrelated/keep.sql'), 'utf8')).toBe('-- Keep another scope\n');
}

test.each(DRIZZLE_MIGRATIONS_SCOPES)(
    'a failed generation in %s reports the failure and preserves every file',
    async (scope) => {
        const testRepository = await applyChanges(scope, 'failure');
        await using directory = testRepository.directory;
        const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
        try {
            expect(await rejection(migrations(testRepository.input))).toContain('Migration generation failed');
            await writeFile(join(directory.path, testRepository.path('schema.txt')), 'current');
            expect(await migrations(testRepository.input)).toStrictEqual([]);
            await expectPreserved(testRepository);
        } finally {
            locate.mockRestore();
        }
    },
);

test.each(DRIZZLE_MIGRATIONS_SCOPES)(
    'a stale schema in %s reports the missing migration files and preserves every file',
    async (scope) => {
        const testRepository = await applyChanges(scope, 'changed');
        await using directory = testRepository.directory;
        const locate = spyOn(executables, 'sync').mockReturnValue(process.execPath);
        try {
            const found = await migrations(testRepository.input);
            expect(found.map(({ check, file, rule }) => ({ check, file, rule }))).toStrictEqual([
                {
                    check: testRepository.check.name,
                    file: toPosix(testRepository.path('migrations/.meta/state.json')),
                    rule: 'stale',
                },
                {
                    check: testRepository.check.name,
                    file: toPosix(testRepository.path('migrations/0001_change.sql')),
                    rule: 'stale',
                },
                {
                    check: testRepository.check.name,
                    file: toPosix(testRepository.path('migrations/meta/log.json')),
                    rule: 'stale',
                },
            ]);
            expect(
                found.every(
                    (entry) =>
                        entry.message ===
                        'drizzle-kit changes this file when generating migrations; regenerate and commit the migration output.',
                ),
            ).toBe(true);
            await writeFile(join(directory.path, testRepository.path('schema.txt')), 'current');
            expect(await migrations(testRepository.input)).toStrictEqual([]);
            await expectPreserved(testRepository);
        } finally {
            locate.mockRestore();
        }
    },
);

test('named-schema Drizzle tables need relations and comments do not satisfy the requirement', async () => {
    await using sandbox = await testdir();
    const schema =
        'const schema = pgSchema("teams");\nexport const members = schema.table("members", { teamId: uuid().references(() => teams.id) });\n// relations(members, () => ({}))\n';
    await createFileTree(sandbox.path, { 'schema.ts': schema });
    await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['drizzle'], { level: 'all' }));
    const input = buildCheckInput(await openSession(sandbox.path), 'drizzle/relations', { paths: ['schema.ts'] });
    expect(relations(input)).toMatchObject([{ file: 'schema.ts', line: 2, rule: 'relations' }]);
    await Bun.write(
        join(sandbox.path, 'schema.ts'),
        `${schema}\nexport const memberRelations = relations(members, () => ({}));\n`,
    );
    const corrected = buildCheckInput(await openSession(sandbox.path), 'drizzle/relations', { paths: ['schema.ts'] });
    expect(relations(corrected)).toStrictEqual([]);
});

test.each(DRIZZLE_RELATIONS_CASES)('Drizzle relations reports its finding and passes after the fix', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...entry.files, 'gspot.toml': buildPolicy(['drizzle'], { level: 'all' }) });
    const command = ['check', '--only', entry.check, '--json'];
    const failed = await runGspot(sandbox.path, command);
    const report = JSON.parse(failed.stdout) as RunReport;
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(report.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
    await createFileTree(sandbox.path, entry.corrected!.files);
    const passed = await runGspot(sandbox.path, command);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect((JSON.parse(passed.stdout) as RunReport).checks).toMatchObject([
        { check: entry.check, status: 'passed', findings: [] },
    ]);
});
