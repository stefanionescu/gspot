import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { CHECKS } from '#cli/checks/registry.ts';
import { gitOutput } from '#tests/harness/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import type { Session } from '#cli/types/planning.ts';
import { applyFixers } from '#cli/execution/fixers.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { rejection } from '#tests/harness/expectations.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { getStaged, getChanged } from '#cli/repository/revisions/changes.ts';
import { NESTED_POLICY, PROJECT_OPTIONS } from '#tests/config/cli/execution/impact.ts';

test('repository checks retain nested inputs and report their defects once at the root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `${NESTED_POLICY}\n[[check]]\nname = "project/syntax"\ncommand = ["bash", "-n", "{files}"]\npaths = ["**/*.sh"]\nstage = "push"\n`,
        'api/source.sh': 'if then\n',
        'web/source.sh': 'echo sibling\n',
    });
    const options = buildRunOptions({
        stage: 'push',
        only: ['project/syntax'],
        changed: ['api/source.sh'],
        isDryRun: true,
    });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'failed' },
    ]);
    await Bun.write(join(sandbox.path, 'api/source.sh'), 'echo corrected\n');
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'passed' },
    ]);
});

function projectChecks(session: Session): void {
    const manifest = session.manifests.get('typescript')!;
    const spec: CheckSpec = {
        name: 'sandbox/project',
        level: 'recommended',
        stage: 'commit',
        runs: 'scope',
        summary: 'Reports the test project finding.',
        why: 'Changed files trigger the complete project check.',
        help: 'Fix the test project finding.',
        cwd: 'root' as const,
        command: [process.execPath, '-e', "console.log('Project finding'); process.exitCode = 1"],
        output: { format: 'lines' as const },
        files: manifest.files,
        fix: [process.execPath, '-e', "await Bun.write('{scope}/source.ts', 'restored')"],
    };
    const fileCheck = { ...spec, name: 'sandbox/files', runs: 'files' as const };
    for (const scope of session.scopes) {
        if (scope.scope.path !== '') scope.selected = [{ ...manifest, tools: [], checks: [spec, fileCheck] }];
    }
}

test.each([
    ['delete', 'staged'],
    ['rename', 'changed'],
])('a last-file %s triggers the affected project with %s selection', async (operation, selection) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_POLICY,
        'api/source.ts': 'export {};\n',
        'web/kept.ts': 'export {};\n',
    });
    gitOutput(sandbox.path, ['init']);
    gitOutput(sandbox.path, ['add', '.']);
    gitOutput(sandbox.path, [
        '-c',
        'user.name=RepositorySetup',
        '-c',
        'user.email=sandbox@example.com',
        'commit',
        '-qm',
        'RepositorySetup',
    ]);
    if (operation === 'delete') gitOutput(sandbox.path, ['rm', 'api/source.ts']);
    else gitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
    mkdirSync(join(sandbox.path, 'api'), { recursive: true });
    const session = await openSession(sandbox.path);
    projectChecks(session);
    const revision =
        selection === 'staged'
            ? await getStaged(sandbox.path).then(({ staged }) => ({ staged }))
            : await getChanged(sandbox.path, 'HEAD').then(({ paths }) => ({ changed: paths }));
    const planned = planRun(session, { ...PROJECT_OPTIONS, ...revision });
    const api = planned.find((check) => check.scope.scope.path === 'api')!;
    expect(api.files).toStrictEqual([]);
    expect(api.triggerPaths).toContain('api/source.ts');
    const fileChecks = planRun(session, { ...PROJECT_OPTIONS, only: ['sandbox/files'], ...revision });
    expect(fileChecks.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
    expect(fileChecks.flatMap((check) => check.files.map((file) => file.path))).toStrictEqual(
        operation === 'delete' ? [] : ['web/source.ts'],
    );
    const outcome = await executeRun(session, buildRunOptions({ ...PROJECT_OPTIONS, ...revision }));
    expect(outcome.report.exitCode).toBe(1);
    expect(outcome.report.checks.map((check) => check.scope)).toStrictEqual(
        operation === 'delete' ? ['api'] : ['api', 'web'],
    );
    expect(
        outcome.report.checks.every((check) => check.findings.some((finding) => finding.message === 'Project finding')),
    ).toBe(true);
    const preview = await applyFixers(session, [api], { isDryRun: true });
    expect(preview.changed).toStrictEqual(['api/source.ts']);
    expect(existsSync(join(sandbox.path, 'api/source.ts'))).toBe(false);
    const applied = await applyFixers(session, [api], { isDryRun: false });
    expect(applied.changed).toStrictEqual(['api/source.ts']);
    expect(readFileSync(join(sandbox.path, 'api/source.ts'), 'utf8')).toBe('restored');
});

test('a positional file trigger preserves project-wide input and findings', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_POLICY,
        'api/source.ts': 'export {};\n',
        'api/caller.ts': 'export {};\n',
        'web/source.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    projectChecks(session);
    const planned = planRun(session, { ...PROJECT_OPTIONS, paths: ['api/source.ts'] });
    const affected = planned.filter((check) => check.files.length > 0);
    expect(affected.map((check) => check.scope.scope.path)).toStrictEqual(['api']);
    expect(affected[0]?.files.map((file) => file.path)).toStrictEqual(['api/caller.ts', 'api/source.ts']);
    const outcome = await executeRun(session, {
        checks: CHECKS,
        ...PROJECT_OPTIONS,
        paths: ['api/source.ts'],
        fix: false,
        isDryRun: false,
    });
    expect(outcome.report.exitCode).toBe(1);
    expect(outcome.report.checks[0]?.findings[0]?.message).toBe('Project finding');
});

test('a check with no command and no built-in check refuses the complete plan before any command runs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript']),
        'source.ts': 'export const count = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!.selected.find(({ configuration }) => configuration.name === 'typescript')!;
    const definition = {
        name: 'sandbox/command',
        level: 'recommended',
        stage: 'commit',
        runs: 'files',
        summary: 'Inspect the source file.',
        why: 'The input must be valid.',
        help: 'Correct the source file.',
    } as const;
    const first: CheckSpec = {
        ...definition,
        command: [process.execPath, '-e', 'await Bun.write("started.txt", "started")'],
    };
    const invalid: CheckSpec = {
        ...definition,
        name: 'sandbox/unknown',
    };
    session.scopes[0]!.selected = [{ ...selected, checks: [first, invalid] }];
    expect(await rejection(executeRun(session, buildRunOptions({ stage: 'commit' })))).toContain(
        'The check sandbox/unknown names no command, and gspot has no built-in check by that name.',
    );
    expect(existsSync(join(sandbox.path, 'started.txt'))).toBe(false);
});

test('a project check without its own inputs is inactive even when its scope contains another language', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift', 'python', 'bash']),
        'source.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['swift/build', 'swift/periphery', 'python/ruff'] });
    const planned = planRun(session, options);
    expect(planned.every((entry) => entry.files.length === 0)).toBe(true);
    const outcome = await executeRun(session, options);
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks).toStrictEqual([]);
    expect(outcome.report.skips).toStrictEqual([
        { check: 'swift/build', cause: process.platform === 'darwin' ? 'inputs' : 'platform' },
        { check: 'swift/periphery', cause: process.platform === 'darwin' ? 'inputs' : 'platform' },
        { check: 'python/ruff', cause: 'inputs' },
    ]);
});

test('a deleted file from another language does not trigger a TypeScript project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': NESTED_POLICY, 'api/kept.ts': 'export {};\n' });
    const session = await openSession(sandbox.path);
    projectChecks(session);
    const planned = planRun(session, { ...PROJECT_OPTIONS, changed: ['api/removed.py'] });
    expect(planned.flatMap((check) => check.files)).toStrictEqual([]);
    expect(planned.flatMap((check) => check.triggerPaths)).toStrictEqual([]);
});

test('a deleted child-scope input triggers only the child project', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': NESTED_POLICY + '\n[[scope]]\npath = "api/nested"\nconfigurations = []\n',
        'api/kept.ts': 'export {};\n',
        'api/nested/README.md': '# Nested\n',
        'web/kept.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    projectChecks(session);
    const planned = planRun(session, { ...PROJECT_OPTIONS, changed: ['api/nested/removed.ts'] });
    expect(
        planned
            .filter((check) => check.triggerPaths.length > 0)
            .map((check) => [check.scope.scope.path, check.triggerPaths]),
    ).toStrictEqual([['api/nested', ['api/nested/removed.ts']]]);
    expect(planned.find((check) => check.scope.scope.path === 'api')?.files).toStrictEqual([]);
});
