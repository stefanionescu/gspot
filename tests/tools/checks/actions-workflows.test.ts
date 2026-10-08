import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { checkRun } from '#cli/execution/built-in.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { levelSchema } from '#cli/parsers/schema/settings.ts';
import { sharePythonTools } from '#tests/harness/python-installation.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

// GitHub self-repository references use $/. The pinned Actionlint needs their local spelling.
test('Actionlint validates required reusable inputs in self-repository workflows and preserves authored files', async () => {
    await using sandbox = await testdir();
    const workflow = `on: workflow_dispatch\njobs:\n  caller:\n    uses: $/.github/workflows/called.yml\n`;
    const called =
        'on:\n  workflow_call:\n    inputs:\n      greeting:\n        type: string\n        required: true\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['actions']),
        '.github/workflows/caller.yml': workflow,
        '.github/workflows/called.yml': called,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['actions/actionlint'] });
    const planned = plans[0]!;
    const failed = await checkRun(planned.check, BUILT_IN_CHECKS)(session, planned);
    expect(failed.status, JSON.stringify(failed)).toBe('failed');
    expect(failed.findings).toContainEqual(
        containing({
            file: '.github/workflows/caller.yml',
            line: 4,
            column: 11,
            rule: 'workflow-call',
            message: textContaining('input "greeting" is required'),
        }),
    );
    expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
    await Bun.write(
        join(sandbox.path, '.github/workflows/caller.yml'),
        `${workflow}    with:\n      greeting: Hello\n`,
    );
    const corrected = await openSession(sandbox.path);
    const correctedPlans = planRun(corrected, { stage: 'commit', skips: [], only: ['actions/actionlint'] });
    const valid = correctedPlans[0]!;
    const result = await checkRun(valid.check, BUILT_IN_CHECKS)(corrected, valid);
    expect(result.status).toBe('passed');
    expect(await Bun.file(join(sandbox.path, '.github/workflows/called.yml')).text()).toBe(called);
});

test('Actionlint resolves a self-repository alias and reports a missing workflow before correction', async () => {
    await using sandbox = await testdir();
    const workflow =
        'on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/.github/workflows/called.yml\njobs:\n  caller:\n    uses: *workflow\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['actions']),
        '.github/workflows/caller.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['actions/actionlint'] });
    const planned = plans[0]!;
    const failed = await checkRun(planned.check, BUILT_IN_CHECKS)(session, planned);
    expect(failed.status, JSON.stringify(failed)).toBe('failed');
    expect(failed.findings).toContainEqual(
        containing({
            file: '.github/workflows/caller.yml',
            line: 3,
            column: 13,
            rule: 'workflow-call',
            message: textContaining('could not read reusable workflow file'),
        }),
    );
    await Bun.write(
        join(sandbox.path, '.github/workflows/called.yml'),
        'on: workflow_call\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n',
    );
    const corrected = await openSession(sandbox.path);
    const correctedPlans = planRun(corrected, { stage: 'commit', skips: [], only: ['actions/actionlint'] });
    const valid = correctedPlans[0]!;
    const result = await checkRun(valid.check, BUILT_IN_CHECKS)(corrected, valid);
    expect(result.status).toBe('passed');
    expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
});

test.each(levelSchema.options)(
    'Zizmor audits composite actions without duplicating pinact at level %s',
    async (level) => {
        await using sandbox = await testdir();
        const composite = `name: Greet
inputs:
    message:
        description: Message to print
        required: true
runs:
    using: composite
    steps:
        - shell: bash
          run: echo "\${{ inputs.message }}"
`;
        const workflow =
            'on: workflow_dispatch\npermissions: {}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          persist-credentials: false\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['actions'], {
                level,
                tables: 'runner = "mise"\n[scope.app]\nconfigurations = ["actions"]\n',
            }),
            '.github/workflows/build.yml': workflow,
            '.github/actions/greet/action.yml': composite,
            'app/.github/workflows/build.yml': workflow,
            'app/.github/actions/greet/action.yaml': composite,
        });
        await sharePythonTools(sandbox.path);
        const session = await openSession(sandbox.path);
        const actionlint = planRun(session, { stage: 'commit', skips: [], only: ['actions/actionlint'] });
        expect(actionlint.flatMap(({ files }) => files.map(({ path }) => path))).toStrictEqual([
            '.github/workflows/build.yml',
            'app/.github/workflows/build.yml',
        ]);
        const failed = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['actions/zizmor'] }));
        expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
        expect(
            failed.report.checks.flatMap(({ findings }) => findings).map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([
            { file: '.github/actions/greet/action.yml', rule: 'template-injection' },
            { file: 'app/.github/actions/greet/action.yaml', rule: 'template-injection' },
        ]);
        for (const path of ['.github/actions/greet/action.yml', 'app/.github/actions/greet/action.yaml'])
            await Bun.write(
                join(sandbox.path, path),
                composite.replace(
                    '          run: echo "${{ inputs.message }}"',
                    '          env:\n              MESSAGE: ${{ inputs.message }}\n          run: echo "$MESSAGE"',
                ),
            );
        const corrected = await executeRun(
            await openSession(sandbox.path),
            buildRunOptions({ stage: 'commit', only: ['actions/zizmor'] }),
        );
        expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
        expect(await Bun.file(join(sandbox.path, '.github/workflows/build.yml')).text()).toBe(workflow);
    },
);
