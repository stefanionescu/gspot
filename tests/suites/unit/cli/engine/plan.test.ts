import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { isActive, planChecks, selectCheckCommand } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import type { GspotError } from '#cli/system/errors.ts';
import type { RunSelection } from '#cli/types/engine/plan.ts';
import { SCOPE_WIDE_IGNORE_CASES } from '#tests/config/engine/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const TWO_WORDS = 'two words';

test('coverage stripping leaves your own checks and given arguments unchanged', async () => {
    const command = [process.execPath, '--coverage', '', TWO_WORDS];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ id: 'project/tests', command, stage: 'push', paths: ['sample.test.cjs'] }],
            }),
        }),
        'sample.test.cjs': 'const authored = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['project/tests'] })[0]!;
    expect(selectCheckCommand(planned, {})).toStrictEqual(command);
    expect(selectCheckCommand(planned, { command: ['echo', '', TWO_WORDS] })).toStrictEqual(['echo', '', TWO_WORDS]);
});

test('a check takes no file of another selected language in its scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'bash']),
        'source.sh': 'echo example\n',
    });

    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, { stage: 'all', only: ['python/ruff'] }).map((planned) => ({
            check: planned.check.id,
            files: planned.files.length,
            active: isActive(planned),
        })),
    ).toStrictEqual([{ check: 'python/ruff', files: 0, active: false }]);
});

test.each([...SCOPE_WIDE_IGNORE_CASES])(
    'an ignore of a whole scope keeps the replaced check running there and nowhere else: $paths',
    async ({ paths, ignored }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['typescript'], {
                rules: true,
                scopes: [
                    { path: 'api', configurations: ['nextjs'] },
                    { path: 'web', configurations: ['nextjs'] },
                ],
                tables: stringify({
                    ignore: [
                        {
                            check: 'nextjs/tsc',
                            paths: [...paths],
                            reason: 'The API check is provided by its own native build pipeline.',
                        },
                    ],
                }),
            }),
            'api/app/page.tsx': 'export default function Page() { return null; }',
            'web/app/page.tsx': 'export default function Page() { return null; }',
        });

        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'all', only: ['nextjs/tsc', 'typescript/tsc'] });
        const scopes = planned.filter((check) => ['api', 'web'].includes(check.scope.path));
        const results = new Map(scopes.map((check) => [`${check.scope.path}:${check.check.id}`, check.skip?.cause]));
        expect(results).toStrictEqual(
            new Map([
                ['api:nextjs/tsc', ignored ? 'ignore' : undefined],
                ['api:typescript/tsc', ignored ? undefined : 'replaced'],
                ['web:nextjs/tsc', undefined],
                ['web:typescript/tsc', 'replaced'],
            ]),
        );
    },
);

test('all plans history checks once at the root and only for pushed commits', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits', 'secrets'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['commits', 'secrets'] }],
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/once',
                        command: ['git', 'log'],
                        paths: ['source.txt', 'app/source.txt'],
                        stage: 'push',
                    },
                ],
            }),
        }),
        'source.txt': 'Root source.\n',
        'app/source.txt': 'Child source.\n',
    });
    const session = await openSession(sandbox.path);
    const names = ['commits/commitlint-pushed', 'secrets/gitleaks-pushed'];
    const pushed: RunSelection = { content: 'commit', paths: [], commits: ['selected'] };
    const planned = planChecks(session, { stage: 'push', only: [...names, 'sandbox/once'], selection: pushed });
    expect(planned.map((check) => check.scope.path)).toStrictEqual([...names.map(() => ''), '']);
    expect(planned.map((check) => isActive(check, pushed))).toStrictEqual([...names.map(() => true), false]);
    const empty: RunSelection = { content: 'commit', paths: [], commits: [] };
    expect(
        planChecks(session, { stage: 'push', only: names, selection: empty }).map((check) => isActive(check, empty)),
    ).toStrictEqual(names.map(() => false));
    const shallow: RunSelection = { content: 'commit', shallow: true };
    expect(() => planChecks(session, { stage: 'push', only: ['secrets/gitleaks-pushed'], selection: shallow })).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'git',
            message: expect.stringContaining('secrets/gitleaks-pushed') as string,
        }),
    );
    expect(planChecks(session, { stage: 'push', only: ['sandbox/once'], selection: shallow })).toHaveLength(1);
});

test('vue/vue-tsc replaces typescript/tsc only while it runs', async () => {
    const check = 'vue/vue-tsc';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue']),
        'source.ts': 'export const port = 8080;\n',
        'src/App.vue': '<template><p>App</p></template>',
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'all' as const, only: ['typescript/tsc', check] };
    expect(planChecks(session, options).find(({ check }) => check.id === 'typescript/tsc')?.skip).toStrictEqual({
        cause: 'replaced',
        note: expect.stringContaining(check) as string,
    });
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript', 'vue'], {
            tables: stringify({ ignore: [{ check, reason: 'The separate compiler checks this source.' }] }),
        }),
    );
    const ignored = await openSession(sandbox.path);
    expect(planChecks(ignored, options).find(({ check }) => check.id === 'typescript/tsc')?.skip).toBeUndefined();
    expect(
        planChecks(session, { ...options, only: ['typescript/tsc'] }).find(({ check }) => check.id === 'typescript/tsc')
            ?.skip,
    ).toBeUndefined();
});

test('a shared function coverage limit enables Jest coverage without enabling pytest coverage', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'pytest', 'jest'], {
            tables: '[coverage]\nmin_line_percent = 0\nmin_function_percent = 100\n',
        }),
        'test_math.py': 'def test_math():\n    assert 1 + 1 == 2\n',
        'math.test.js': 'test("sum", () => expect(1 + 1).toBe(2));\n',
    });
    const plans = planChecks(await openSession(sandbox.path), {
        stage: 'push',
        only: ['pytest/tests', 'jest/tests'],
    });
    const jestPlan = plans.find(({ check }) => check.id === 'jest/tests')!;
    const pytestPlan = plans.find(({ check }) => check.id === 'pytest/tests')!;
    expect(selectCheckCommand(jestPlan, {})).toContain('--coverage');
    expect(selectCheckCommand(pytestPlan, {})).not.toContain('--cov');
});

test('stage all leaves out message checks even when only names one', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }) });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, { stage: 'all', only: ['commits/commitlint'] }).map(({ check }) => check.id),
    ).toStrictEqual([]);
    expect(
        planChecks(session, {
            stage: 'message',
            only: ['commits/commitlint'],
            selection: { content: 'message', messageFile: 'message.txt' },
        }).map(({ check, scope }) => [check.id, scope.path]),
    ).toStrictEqual([['commits/commitlint', '']]);
});

test('a check selected in two scopes runs once at the root', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docker'], {
            scopes: [{ path: 'app', configurations: ['docker'] }],
        }),
        Dockerfile: 'FROM scratch\n',
        'app/Dockerfile': 'FROM scratch\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, { stage: 'all', only: ['docker/dockerignore'] }).map(({ check, scope }) => [
            check.id,
            scope.path,
        ]),
    ).toStrictEqual([['docker/dockerignore', '']]);
});

test('a replacer with no matching files leaves the original check active', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue']),
        'source.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, { stage: 'push', only: ['typescript/tsc', 'vue/vue-tsc'] }).map((planned) => ({
            check: planned.check.id,
            active: isActive(planned),
            skip: planned.skip,
        })),
    ).toStrictEqual([
        { check: 'typescript/tsc', active: true, skip: undefined },
        { check: 'vue/vue-tsc', active: false, skip: undefined },
    ]);
});

test('a skipped check leaves the plan, and the check it replaces stays off', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue']),
        'source.ts': 'export const value = 1;\n',
        'App.vue': '<template><p>Hello</p></template>\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', skip: ['vue/vue-tsc'] });
    expect(planned.map(({ check }) => check.id)).not.toContain('vue/vue-tsc');
    expect(planned.find(({ check }) => check.id === 'typescript/tsc')?.skip).toStrictEqual({
        cause: 'replaced',
        note: expect.stringContaining('vue/vue-tsc') as string,
    });
});

test('explicit paths intersect the staged set', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'first.js': 'export const first = 1;\n',
        'second.js': 'export const second = 2;\n',
        'third.js': 'export const third = 3;\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, {
            stage: 'commit',
            only: ['javascript/eslint'],
            paths: ['first.js', 'second.js'],
            selection: { content: 'index', paths: ['second.js', 'third.js'] },
        }).map(({ check, files }) => ({ check: check.id, files: files.map(({ path }) => path) })),
    ).toStrictEqual([{ check: 'javascript/eslint', files: ['second.js'] }]);
});

test('a skipped history check does not refuse a shallow push', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['secrets'], {
            tables: '[[ignore]]\ncheck = "secrets/gitleaks-pushed"\nreason = "The server scans pushed history."\n',
        }),
        'source.js': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, {
            stage: 'push',
            only: ['secrets/gitleaks-pushed'],
            selection: { content: 'commit', shallow: true, commits: ['selected'] },
        }).map(({ check, skip }) => ({ check: check.id, skip })),
    ).toStrictEqual([
        {
            check: 'secrets/gitleaks-pushed',
            skip: { cause: 'ignore', note: expect.stringContaining('The server scans pushed history.') as string },
        },
    ]);
});

test.each([
    { name: 'one root config', files: { 'vitest.config.mjs': '' }, scopes: [''] },
    {
        name: 'a config in each package',
        files: { 'a/vitest.config.mjs': '', 'b/vitest.config.mjs': '' },
        scopes: ['a', 'b'],
    },
    {
        name: 'a root config and one package config',
        files: { 'vitest.config.mjs': '', 'b/vitest.config.mjs': '' },
        scopes: ['', 'b'],
    },
])('vitest runs only where a test config sits, with $name', async ({ files, scopes }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': `configurations = ["vitest"]\n\n[[scope]]\npath = "a"\nconfigurations = ["vitest"]\n\n[[scope]]\npath = "b"\nconfigurations = ["vitest"]\n`,
        'a/a.test.js': '',
        'b/b.test.js': '',
        ...files,
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'push', only: ['vitest/tests'] });
    expect(planned.map(({ scope }) => scope.path)).toStrictEqual([...scopes]);
});
