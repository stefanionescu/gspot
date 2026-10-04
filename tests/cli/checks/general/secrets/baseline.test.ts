import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { unlinkSync, symlinkSync, readFileSync } from 'node:fs';
import { GITLEAKS_BASELINE } from '#cli/config/platform/locations.ts';
import { BASELINE, BASELINE_REASONS } from '#tests/config/cli/checks/general/secrets/baseline.ts';

// Baseline review is built-in policy logic; these repositories install no external tools.
test('unexplained current and historical baselines fail until reasons and current files are restored', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['secrets'], { level: 'all' }),
        [GITLEAKS_BASELINE]: BASELINE,
    });
    const options = buildRunOptions({ only: ['secrets/gitleaks-baseline'] });
    const rejected = await executeRun(await openSession(sandbox.path), options);
    expect(rejected.report.exitCode).toBe(1);
    expect(rejected.report.checks).toHaveLength(1);
    expect(rejected.report.checks[0]?.status).toBe('failed');
    expect(rejected.report.checks[0]?.findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual([
        { file: GITLEAKS_BASELINE, rule: 'missing-reason', line: 1 },
        { file: GITLEAKS_BASELINE, rule: 'stale-entry', line: 1 },
        { file: GITLEAKS_BASELINE, rule: 'missing-reason', line: 1 },
    ]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy(['secrets'], { level: 'all', tables: BASELINE_REASONS }),
    );
    const stillMissing = await executeRun(await openSession(sandbox.path), options);
    expect(stillMissing.report.exitCode).toBe(1);
    expect(stillMissing.report.checks[0]?.findings.map(({ rule }) => rule)).toStrictEqual(['stale-entry']);
    await Bun.write(join(sandbox.path, 'old.py'), '# A reviewed historical fixture.\n');
    const accepted = await executeRun(await openSession(sandbox.path), options);
    expect(accepted.report.exitCode).toBe(0);
    expect(accepted.report.checks).toMatchObject([
        { check: 'secrets/gitleaks-baseline', status: 'passed', findings: [] },
    ]);
});

test('missing and empty baseline files pass without external tools', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['secrets']) });
    const options = buildRunOptions({ only: ['secrets/gitleaks-baseline'] });
    const missing = await executeRun(await openSession(sandbox.path), options);
    expect(missing.report.exitCode).toBe(0);
    expect(missing.report.checks[0]?.findings).toStrictEqual([]);
    await Bun.write(join(sandbox.path, GITLEAKS_BASELINE), '[]');
    const empty = await executeRun(await openSession(sandbox.path), options);
    expect(empty.report.exitCode).toBe(0);
    expect(empty.report.checks[0]?.status).toBe('passed');
});

test('malformed secret-bearing baseline bytes produce a safe check error and recover after correction', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['secrets']),
        [GITLEAKS_BASELINE]: '[{"Secret":"sensitive-baseline-value"',
    });
    const options = buildRunOptions({ only: ['secrets/gitleaks-baseline'] });
    const rejected = await executeRun(await openSession(sandbox.path), options);
    expect(rejected.report.exitCode).toBe(2);
    expect(rejected.report.checks).toMatchObject([
        { check: 'secrets/gitleaks-baseline', status: 'error', findings: [] },
    ]);
    expect(rejected.report.checks[0]?.note).toContain(GITLEAKS_BASELINE);
    expect(JSON.stringify(rejected.report)).not.toContain('sensitive-baseline-value');
    await Bun.write(join(sandbox.path, GITLEAKS_BASELINE), '[]');
    const corrected = await executeRun(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks[0]?.status).toBe('passed');
});

test('a managed secret baseline rejects linked bytes before evaluating entries', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/gspot.toml': buildPolicy(['secrets'], { level: 'all' }),
        'project/.gspot/.keep': '',
        'baseline.json': '[]\n',
    });
    const root = join(sandbox.path, 'project');
    const baseline = join(root, GITLEAKS_BASELINE);
    symlinkSync('../../baseline.json', baseline);
    const options = buildRunOptions({ only: ['secrets/gitleaks-baseline'] });
    const refused = await executeRun(await openSession(root), options);
    expect(refused.report.exitCode).toBe(2);
    expect(refused.report.checks[0]).toMatchObject({ status: 'error', findings: [] });
    expect(refused.report.checks[0]!.note).toContain('private regular file');
    unlinkSync(baseline);
    await Bun.write(baseline, '[]\n');
    const corrected = await executeRun(await openSession(root), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(readFileSync(join(sandbox.path, 'baseline.json'), 'utf8')).toBe('[]\n');
});
