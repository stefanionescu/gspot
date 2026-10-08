import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

// Recommended keeps syntax enforcement while leaving naming preferences inactive.
async function expectRecommendedLevel(root: string, command: string[]): Promise<void> {
    const recommended = await runGspot(root, command);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
    const report = JSON.parse(recommended.stdout) as RunReport;
    expect(report.skips).toStrictEqual([]);
    expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/syntax', status: 'passed' },
    ]);
    await Bun.write(join(root, 'entry.sh'), 'if then\n');
    const invalid = await runGspot(root, command);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks[0]).toMatchObject({
        check: 'bash/syntax',
        status: 'failed',
        fileCount: 1,
    });
    await Bun.write(join(root, 'entry.sh'), 'helper_command=example\n');
}

test('switching levels preserves finding checks and selects stricter naming checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'naming'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'helper_command=example\n',
    });
    const command = ['check', '--only', 'bash/syntax', 'naming/identifiers', '--json'];
    await expectRecommendedLevel(sandbox.path, command);
    const all = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(all.code, all.stdout + all.stderr).toBe(0);
    const strict = await runGspot(sandbox.path, command);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    const strictReport = JSON.parse(strict.stdout) as RunReport;
    expect(strictReport.skips).toStrictEqual([]);
    expect(strictReport.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/syntax', status: 'passed' },
        { check: 'naming/identifiers', status: 'failed' },
    ]);
    expect(strictReport.checks[1]!.findings).toHaveLength(1);
    expect(strictReport.checks[1]!.findings[0]).toMatchObject({
        check: 'naming/identifiers',
        file: 'entry.sh',
        line: 1,
        rule: 'banned-term',
    });
    const reset = await runGspot(sandbox.path, ['set', 'level', '--default']);
    expect(reset.code, reset.stdout + reset.stderr).toBe(0);
    const routine = await runGspot(sandbox.path, command);
    expect(routine.code, routine.stdout + routine.stderr).toBe(0);
    expect((JSON.parse(routine.stdout) as RunReport).checks.map((check) => check.check)).toStrictEqual(['bash/syntax']);
    const strictAgain = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(strictAgain.code, strictAgain.stdout + strictAgain.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'entry.sh'), 'command=example\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/syntax', status: 'passed', findings: [] },
        { check: 'naming/identifiers', status: 'passed', findings: [] },
    ]);
});

test('an invalid level preserves the policy', async () => {
    await using sandbox = await testdir();
    const policyPath = join(sandbox.path, 'gspot.toml');
    const policy = buildPolicy(['bash', 'naming']);
    await Bun.write(policyPath, policy);
    const refused = await runGspot(sandbox.path, ['set', 'level', 'strict']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(await Bun.file(policyPath).text()).toBe(policy);
});
