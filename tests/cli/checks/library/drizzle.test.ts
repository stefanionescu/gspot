import executables from 'which';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { toPosix } from '#cli/platform/contracts.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { getStaged } from '#cli/repository/revisions/public.ts';
import { rejection, containing } from '#tests/harness/expectations.ts';
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
    const check = session.manifests.get('drizzle')!.checks.find((entry) => entry.name === 'drizzle/stale-migrations')!;
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
            expect(await rejection(BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input))).toContain(
                'Migration generation failed',
            );
            await writeFile(join(directory.path, testRepository.path('schema.txt')), 'current');
            expect(await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input)).toStrictEqual([]);
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
            const found = await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input);
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
                        'Running ["drizzle-kit","generate"] changes this generated file; commit what it writes.',
                ),
            ).toBe(true);
            await writeFile(join(directory.path, testRepository.path('schema.txt')), 'current');
            expect(await BUILT_IN_CHECKS['supabase/stale-types'].input(testRepository.input)).toStrictEqual([]);
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
    expect(BUILT_IN_CHECKS['drizzle/relations'].input(input)).toMatchObject([
        { file: 'schema.ts', line: 2, rule: 'relations' },
    ]);
    await Bun.write(
        join(sandbox.path, 'schema.ts'),
        `${schema}\nexport const memberRelations = relations(members, () => ({}));\n`,
    );
    const corrected = buildCheckInput(await openSession(sandbox.path), 'drizzle/relations', { paths: ['schema.ts'] });
    expect(BUILT_IN_CHECKS['drizzle/relations'].input(corrected)).toStrictEqual([]);
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

test.each(['', 'packages/db'])('staged Drizzle tables retain unstaged scope relations in %s', async (scope) => {
    await using sandbox = await testdir();
    const source = join(scope, 'schema.ts');
    const declarations = join(scope, 'relations.ts');
    await createFileTree(sandbox.path, {
        'gspot.toml':
            buildPolicy(['drizzle'], { level: 'all' }) +
            (scope === '' ? '' : `[scope."${scope}"]\nconfigurations = []\n`),
        [source]: 'export const members = pgTable("members", { teamId: integer().references(() => teams.id) });\n',
        [declarations]: 'export const declared = relations(members, () => ({}));\n',
    });
    commitAll(sandbox.path);
    await writeFile(
        join(sandbox.path, source),
        (await readFile(join(sandbox.path, source), 'utf8')) + '// Table change\n',
    );
    gitOutput(sandbox.path, ['add', source]);
    const { staged } = await getStaged(sandbox.path);
    expect(staged).toStrictEqual([toPosix(source)]);
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', skips: [], staged, only: ['drizzle/relations'] });
    const selected = planned.find((entry) => entry.scope.scope.path === scope)!;
    expect(selected.files.map((file) => file.path)).toContain(declarations);
    expect(BUILT_IN_CHECKS['drizzle/relations'].input(checkInput(session, selected))).toStrictEqual([]);
    await writeFile(join(sandbox.path, declarations), '// relations(members, () => ({}))\n');
    const missing = await openSession(sandbox.path);
    const active = planRun(missing, { stage: 'commit', skips: [], staged: [source], only: ['drizzle/relations'] }).find(
        (entry) => entry.scope.scope.path === scope,
    )!;
    expect(BUILT_IN_CHECKS['drizzle/relations'].input(checkInput(missing, active))).toMatchObject([
        { file: toPosix(source), rule: 'relations' },
    ]);
});

test.each(['{ teams, members }', '{ teams, people: members }'])(
    'defineRelations declares every named table in %s and preserves child ownership',
    async (tables) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['drizzle'], { level: 'all' }) + '[scope.child]\nconfigurations = []\n',
            'schema.ts':
                'export const members = pgTable("members", { teamId: integer().references(() => teams.id) });\n',
            'relations.ts': `export const declared = defineRelations(${tables});\n`,
            'child/schema.ts':
                'export const members = pgTable("members", { teamId: integer().references(() => teams.id) });\n',
            'child/relations.ts': '// defineRelations({ members })\nconst example = "defineRelations({ members })";\n',
        });
        const session = await openSession(sandbox.path);
        expect(BUILT_IN_CHECKS['drizzle/relations'].input(buildCheckInput(session, 'drizzle/relations'))).toStrictEqual(
            [],
        );
        expect(
            BUILT_IN_CHECKS['drizzle/relations'].input(
                buildCheckInput(session, 'drizzle/relations', { scope: 'child' }),
            ),
        ).toMatchObject([{ file: 'child/schema.ts', rule: 'relations' }]);
        await writeFile(
            join(sandbox.path, 'child/relations.ts'),
            `export const declared = defineRelations(${tables});\n`,
        );
        expect(
            BUILT_IN_CHECKS['drizzle/relations'].input(
                buildCheckInput(await openSession(sandbox.path), 'drizzle/relations', { scope: 'child' }),
            ),
        ).toStrictEqual([]);
    },
);
