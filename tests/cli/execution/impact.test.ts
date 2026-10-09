import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { projectChecks } from '#tests/harness/input.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import { getStaged, getChanged } from '#cli/repository/revisions/public.ts';
import { BASE_CHECK } from '#tests/config/cli/execution/command/findings.ts';
import { PROJECT_PATH_IGNORES } from '#tests/config/cli/execution/impact.ts';
import { NESTED_POLICY, PROJECT_OPTIONS, PROJECT_TRIGGERS } from '#tests/config/samples/commands.ts';

test('command checks retain nested inputs and report their findings once at the root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `${NESTED_POLICY}\n[check."project/syntax"]\ncommand = ["bash", "-n", "{files}"]\npaths = ["**/*.sh"]\nstage = "push"\n`,
        'api/source.sh': 'if then\n',
        'web/source.sh': 'echo sibling\n',
    });
    const options = buildRunOptions({
        stage: 'push',
        only: ['project/syntax'],
        changed: ['api/source.sh'],
    });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'failed' },
    ]);
});

test.each(PROJECT_TRIGGERS)(
    'a last-file %s triggers the affected project with %s selection',
    async (operation, selection) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': NESTED_POLICY,
            'api/source.ts': 'export {};\n',
            'web/kept.ts': 'export {};\n',
        });
        commitAll(sandbox.path);
        if (operation === 'delete') gitOutput(sandbox.path, ['rm', 'api/source.ts']);
        else gitOutput(sandbox.path, ['mv', 'api/source.ts', 'web/source.ts']);
        await mkdir(join(sandbox.path, 'api'), { recursive: true });
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
            outcome.report.checks.every((check) =>
                check.findings.some((finding) => finding.message === 'Project finding'),
            ),
        ).toBe(true);
    },
);

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
    const outcome = await executeRun(session, buildRunOptions({ ...PROJECT_OPTIONS, paths: ['api/source.ts'] }));
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
        ...BASE_CHECK,
        name: 'sandbox/command',
        summary: 'Inspect the source file.',
        why: 'The input must be valid.',
        help: 'Correct the source file.',
    } as const;
    const first: CheckDeclaration = {
        ...definition,
        command: [process.execPath, '-e', 'await Bun.write("started.txt", "started")'],
    };
    const invalid: CheckDeclaration = {
        ...definition,
        name: 'sandbox/unknown',
    };
    delete invalid.command;
    session.scopes[0]!.selected = [{ ...selected, checks: [first, invalid] }];
    expect(await rejection(executeRun(session, buildRunOptions({ stage: 'commit' })))).toContain(
        'The check sandbox/unknown names no command, and gspot has no built-in check by that name.',
    );
    expect(await pathExists(join(sandbox.path, 'started.txt'))).toBe(false);
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
        { check: 'swift/build', cause: ['darwin', 'linux'].includes(process.platform) ? 'inputs' : 'platform' },
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
        'gspot.toml': NESTED_POLICY + '\n[scope."api/nested"]\nconfigurations = []\n',
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

test.each(PROJECT_PATH_IGNORES)(
    '$name preserves project input selection',
    async ({ changed, present, check, rule, files }) => {
        await using sandbox = await testdir();
        const ruleField = rule === undefined ? '' : `rule = "${rule}"\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml':
                NESTED_POLICY +
                `\n[[ignore]]\ncheck = "${check}"\n${ruleField}paths = ["api/ignored.ts"]\nreason = "This input is evaluated by its owning pipeline."\n`,
            'api/kept.ts': 'export {};\n',
            ...(present ? { 'api/ignored.ts': 'export {};\n' } : {}),
        });
        const session = await openSession(sandbox.path);
        projectChecks(session);
        const planned = planRun(session, { ...PROJECT_OPTIONS, changed });
        expect(planned.flatMap((entry) => entry.files.map((file) => file.path))).toStrictEqual(files);
        expect(planned.flatMap((entry) => entry.triggerPaths)).toStrictEqual([]);
    },
);
