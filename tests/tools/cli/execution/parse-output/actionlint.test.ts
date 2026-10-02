import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { checkExecution } from '#cli/execution/engines.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

// The scalar forms are a unit test of the rewrite; these two cases run actionlint itself on the rewritten text.
test.each(['$/'])('Actionlint validates reusable inputs for scalar %s and preserves authored files', async (prefix) => {
    await using sandbox = await testdir();
    const quote = /^["']/u.exec(prefix)?.[0] ?? '';
    const workflow = `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${prefix}.github/workflows/called.yml${quote}\n`;
    const called =
        'on:\n  workflow_call:\n    inputs:\n      greeting:\n        type: string\n        required: true\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hello\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['files']),
        '.github/workflows/caller.yml': workflow,
        '.github/workflows/called.yml': called,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['files/actions'] });
    const planned = plans[0]!;
    const failed = await checkExecution(planned.spec, CHECKS)(session, planned);
    expect(failed.status, JSON.stringify(failed)).toBe('fail');
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
    const correctedPlans = planRun(corrected, { stage: 'commit', skips: [], only: ['files/actions'] });
    const valid = correctedPlans[0]!;
    const result = await checkExecution(valid.spec, CHECKS)(corrected, valid);
    expect(result.status).toBe('ok');
    expect(await Bun.file(join(sandbox.path, '.github/workflows/called.yml')).text()).toBe(called);
});

test('Actionlint resolves a self-repository alias and reports a missing workflow before correction', async () => {
    await using sandbox = await testdir();
    const workflow =
        'on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/.github/workflows/called.yml\njobs:\n  caller:\n    uses: *workflow\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['files']),
        '.github/workflows/caller.yml': workflow,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['files/actions'] });
    const planned = plans[0]!;
    const failed = await checkExecution(planned.spec, CHECKS)(session, planned);
    expect(failed.status, JSON.stringify(failed)).toBe('fail');
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
    const correctedPlans = planRun(corrected, { stage: 'commit', skips: [], only: ['files/actions'] });
    const valid = correctedPlans[0]!;
    const result = await checkExecution(valid.spec, CHECKS)(corrected, valid);
    expect(result.status).toBe('ok');
    expect(await Bun.file(join(sandbox.path, '.github/workflows/caller.yml')).text()).toBe(workflow);
});
