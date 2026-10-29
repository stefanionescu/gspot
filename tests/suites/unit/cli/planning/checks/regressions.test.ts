import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { isActive, planChecks } from '#cli/planning/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('stage all leaves out message checks even when only names one', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }) });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, { stage: 'all', only: ['commits/commitlint'] }).map(({ check }) => check.id),
    ).toStrictEqual([]);
    expect(
        planChecks(session, { stage: 'message', only: ['commits/commitlint'], messageFile: 'message.txt' }).map(
            ({ check, scope }) => [check.id, scope.path],
        ),
    ).toStrictEqual([['commits/commitlint', '']]);
});

test('a check selected in two scopes runs once at the root', async () => {
    await using sandbox = await testdir({
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
    await using sandbox = await testdir({
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

test('explicit paths intersect the staged set', async () => {
    await using sandbox = await testdir({
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
            staged: ['second.js', 'third.js'],
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
            shallow: true,
            commits: ['selected'],
        }).map(({ check, skip }) => ({ check: check.id, skip })),
    ).toStrictEqual([
        {
            check: 'secrets/gitleaks-pushed',
            skip: { cause: 'ignore', note: 'turned off by an ignore in gspot.toml: The server scans pushed history.' },
        },
    ]);
});
