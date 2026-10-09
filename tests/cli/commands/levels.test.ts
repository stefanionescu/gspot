import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';

test('switching levels preserves finding checks and selects stricter naming checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'naming'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'helper_command=example\n',
    });
    const command = ['check', '--only', 'bash/bash-syntax', 'naming/identifiers', '--json'];
    const recommended = await checkReport(sandbox.path, command);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
    const report = recommended.report;
    expect(report.skips).toStrictEqual([]);
    expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/bash-syntax', status: 'passed' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.sh'), 'if then\n');
    const invalid = await checkReport(sandbox.path, command);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks[0]).toMatchObject({
        check: 'bash/bash-syntax',
        status: 'failed',
        fileCount: 1,
    });
    await Bun.write(join(sandbox.path, 'entry.sh'), 'helper_command=example\n');
    const all = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(all.code, all.stdout + all.stderr).toBe(0);
    const strict = await checkReport(sandbox.path, command);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    const strictReport = strict.report;
    expect(strictReport.skips).toStrictEqual([]);
    expect(strictReport.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/bash-syntax', status: 'passed' },
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
    const routine = await checkReport(sandbox.path, command);
    expect(routine.code, routine.stdout + routine.stderr).toBe(0);
    expect(routine.report.checks.map((check) => check.check)).toStrictEqual(['bash/bash-syntax']);
});

test('an invalid level preserves the policy', async () => {
    await using sandbox = await testdir();
    const policyPath = join(sandbox.path, 'gspot.toml');
    const policy = buildPolicy(['bash', 'naming']);
    await Bun.write(policyPath, policy);
    const refused = await runGspot(sandbox.path, ['set', 'level', 'strict']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Invalid option: expected one of');
    expect(refused.stdout + refused.stderr).toContain('recommended');
    expect(refused.stdout + refused.stderr).toContain('all');
    expect(await Bun.file(policyPath).text()).toBe(policy);
});
