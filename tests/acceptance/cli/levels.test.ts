import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

// Recommended keeps syntax enforcement while leaving naming preferences inactive.
async function expectRecommendedLevel(root: string, command: string[]): Promise<void> {
    const recommended = await spawnGspot(root, command);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
    const report = JSON.parse(recommended.stdout) as RunReport;
    expect(report.skips).toStrictEqual([]);
    expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/syntax', status: 'ok' },
    ]);
    await Bun.write(join(root, 'entry.sh'), 'if then\n');
    const invalid = await spawnGspot(root, command);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect((JSON.parse(invalid.stdout) as RunReport).checks[0]).toMatchObject({
        check: 'bash/syntax',
        status: 'fail',
        files: 1,
    });
    await Bun.write(join(root, 'entry.sh'), 'helper_command=example\n');
}

// A reasoned allowance suppresses one finding; removing it restores enforcement.
async function expectNamingAllowance(root: string, command: string[]): Promise<void> {
    const allowed = await spawnGspot(root, [
        'set',
        'naming.allowed',
        '{"name":"helper_command"}',
        '--reason',
        'External protocol fixes this name',
    ]);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const accepted = await spawnGspot(root, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect((JSON.parse(accepted.stdout) as RunReport).checks[1]?.findings).toStrictEqual([]);
    const removed = await spawnGspot(root, ['set', 'naming.allowed', 'helper_command', '--remove']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await spawnGspot(root, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect((JSON.parse(restored.stdout) as RunReport).checks[1]?.findings[0]?.rule).toBe('banned-term');
}

test(
    'levels preserve defect checks and require an explicit opt-in for naming preferences',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['bash', 'naming'], '[guides]\ninstall = false\n'),
            'entry.sh': 'helper_command=example\n',
        });
        const command = ['check', '--only', 'bash/syntax', 'naming/identifiers', '--json'];
        await expectRecommendedLevel(sandbox.path, command);
        const all = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
        expect(all.code, all.stdout + all.stderr).toBe(0);
        const strict = await spawnGspot(sandbox.path, command);
        expect(strict.code, strict.stdout + strict.stderr).toBe(1);
        const strictReport = JSON.parse(strict.stdout) as RunReport;
        expect(strictReport.skips).toStrictEqual([]);
        expect(strictReport.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
            { check: 'bash/syntax', status: 'ok' },
            { check: 'naming/identifiers', status: 'fail' },
        ]);
        expect(strictReport.checks[1]!.findings).toHaveLength(1);
        expect(strictReport.checks[1]!.findings[0]).toMatchObject({
            check: 'naming/identifiers',
            file: 'entry.sh',
            line: 1,
            rule: 'banned-term',
        });
        await expectNamingAllowance(sandbox.path, command);
        const reset = await spawnGspot(sandbox.path, ['set', 'level', '--default']);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const extra = await spawnGspot(sandbox.path, ['set', 'extra_checks', 'naming/identifiers']);
        expect(extra.code, extra.stdout + extra.stderr).toBe(0);
        const optedIn = await spawnGspot(sandbox.path, command);
        expect(optedIn.code, optedIn.stdout + optedIn.stderr).toBe(1);
        expect((JSON.parse(optedIn.stdout) as RunReport).checks[1]?.status).toBe('fail');
        await Bun.write(join(sandbox.path, 'entry.sh'), 'command=example\n');
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'bash/syntax', status: 'ok', findings: [] },
            { check: 'naming/identifiers', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

test.each([
    ['level', 'strict'],
    ['extra_checks', 'unknown/check'],
])('invalid %s value %s preserves the policy', async (key, value) => {
    await using sandbox = await testdir();
    const policyPath = join(sandbox.path, 'gspot.toml');
    const policy = policyOf(['bash', 'naming'], 'extra_checks = ["naming/identifiers"]\n');
    await Bun.write(policyPath, policy);
    const refused = await spawnGspot(sandbox.path, ['set', key, value]);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(await Bun.file(policyPath).text()).toBe(policy);
});
