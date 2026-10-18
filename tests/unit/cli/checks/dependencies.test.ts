import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { TWO_SCOPES, SETTING_REASON } from '#tests/data/commands/set.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';
import { HOST_LOCKFILE, LOCKFILE_HOST_CASES, DEPENDENCIES_SANDBOX } from '#tests/data/checks/dependencies.ts';

test('Git download hosts need a reviewed allow-list entry, and HTTPS stays required', async () => {
    await using sandbox = await testdir();
    const insecureDownload = new URL(HOST_LOCKFILE.packages['node_modules/third'].resolved);
    insecureDownload.protocol = 'http:';
    const lockfile = {
        ...HOST_LOCKFILE,
        packages: {
            ...HOST_LOCKFILE.packages,
            'node_modules/third': { ...HOST_LOCKFILE.packages['node_modules/third'], resolved: insecureDownload.href },
        },
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([]),
        'package-lock.json': JSON.stringify(lockfile, null, 2),
    });
    const command = ['check', '--only', 'dependencies/lockfiles', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toHaveLength(3);
    const allowed = await runGspot(sandbox.path, [
        'set',
        'dependencies.allowed_registries',
        'github.com',
        'codeload.github.com',
        '--reason',
        SETTING_REASON,
    ]);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const insecure = await checkReport(sandbox.path, command);
    expect(insecure.code, insecure.stdout + insecure.stderr).toBe(1);
    expect(insecure.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'package-lock.json',
            rule: 'host',
            message: `${insecureDownload.href} is not HTTPS.`,
        },
    ]);
    await Bun.write(join(sandbox.path, 'package-lock.json'), JSON.stringify(HOST_LOCKFILE));
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('an allowed registry host applies only in its scope, and unset restores the default', async () => {
    await using sandbox = await testdir();
    const lockfile = JSON.stringify(HOST_LOCKFILE, null, 2);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { rules: true, tables: TWO_SCOPES }),
        'package-lock.json': lockfile,
        'app/package-lock.json': lockfile,
        'sibling/package-lock.json': lockfile,
    });
    const allowed = await runGspot(sandbox.path, [
        'set',
        'dependencies.allowed_registries',
        'github.com',
        'codeload.github.com',
        '--scope',
        'app',
        '--reason',
        SETTING_REASON,
    ]);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const command = ['check', '--only', 'dependencies/lockfiles', '--json'];
    const isolated = await checkReport(sandbox.path, command);
    expect(isolated.code, isolated.stdout + isolated.stderr).toBe(1);
    expect(
        isolated.report.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            files: findings.map(({ file }) => file),
        })),
    ).toStrictEqual([
        { scope: '', status: 'failed', files: ['package-lock.json', 'package-lock.json', 'package-lock.json'] },
        { scope: 'app', status: 'passed', files: [] },
        {
            scope: 'sibling',
            status: 'failed',
            files: ['sibling/package-lock.json', 'sibling/package-lock.json', 'sibling/package-lock.json'],
        },
    ]);
    const narrowed = await checkReport(sandbox.path, [...command, '--', 'app/package-lock.json']);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(0);
    expect(narrowed.report.checks).toMatchObject([
        { scope: '', status: 'skipped', findings: [] },
        { scope: 'app', status: 'passed', findings: [] },
        { scope: 'sibling', status: 'skipped', findings: [] },
    ]);
    const reset = await runGspot(sandbox.path, ['unset', 'dependencies.allowed_registries', '--scope', 'app']);
    expect(reset.code, reset.stdout + reset.stderr).toBe(0);
    const restored = await checkReport(sandbox.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(
        restored.report.checks.map(({ scope, findings }) => ({
            scope,
            count: findings.length,
        })),
    ).toStrictEqual([
        { scope: '', count: 3 },
        { scope: 'app', count: 3 },
        { scope: 'sibling', count: 3 },
    ]);
});

test.each([...LOCKFILE_HOST_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await using sandbox = await createSandbox(DEPENDENCIES_SANDBOX);
    const result = await runCheckSample(sandbox, entry, DEPENDENCIES_SANDBOX);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
