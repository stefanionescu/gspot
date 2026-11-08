import { expect, test } from 'bun:test';

import { isActive, planChecks, stripCoverageArguments } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
    expect(stripCoverageArguments(jestPlan, {})).toContain('--coverage');
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

test('v8r keeps unowned schema files and excludes files validated by other tools', async () => {
    const otherToolFiles = [
        'package.json',
        'tsconfig.json',
        'app/tsconfig.build.json',
        'jsconfig.json',
        '.github/workflows/test.yml',
        'mise.toml',
        '.mise.toml',
        '.mise/conf.d/tools.toml',
        '.config/mise/config.toml',
        '.mise.production.toml',
    ];
    const schemaFiles = ['compose.yaml', '.github/dependabot.yml', 'renovate.json', 'app/config.json'];
    await using sandbox = await createGitSandbox({
        ...Object.fromEntries(
            [...otherToolFiles, ...schemaFiles].map((path) => [path, path.endsWith('.toml') ? '' : '{}']),
        ),
        'gspot.toml': buildSandboxSettings(['data-files']),
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'push', only: ['data-files/v8r'] });
    expect(planned.flatMap(({ files }) => files.map(({ path }) => path)).toSorted(compareText)).toStrictEqual(
        schemaFiles.toSorted(compareText),
    );
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
