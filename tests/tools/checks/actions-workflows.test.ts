import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { checkRun } from '#cli/execution/built-in.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/built-in.ts';
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
