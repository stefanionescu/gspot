// The Bash conventions a project names itself: none applies until the policy names it.
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { ONLY, RULES, SCRIPT } from '#tests/config/cli/checks/bash-conventions.ts';

async function rules(policy: string): Promise<string[]> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: policy, level: 'all' }),
        'deploy.sh': SCRIPT,
    });
    const run = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ONLY }));
    return run.report.checks
        .flatMap(({ findings }) => findings.map(({ rule }) => rule ?? ''))
        .filter((rule) => RULES.has(rule))
        .toSorted((left, right) => left.localeCompare(right));
}

test('remote functions, entry functions, and the runtime header apply only once the policy names them', async () => {
    expect(await rules('')).toStrictEqual(['never-called']);
    expect(
        await rules('[bash]\nremote_functions = ["run_remote"]\nentry_functions = ["run_step"]\nplatforms = "Linux"\n'),
    ).toStrictEqual(['header', 'runtime-header', 'unnamed-block']);
});
