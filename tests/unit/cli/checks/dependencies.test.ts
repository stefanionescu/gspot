import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { SETTING_REASON } from '#tests/data/commands/set.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/sample-checks.ts';
import { HOST_LOCKFILE, LOCKFILE_HOST_CASES, DEPENDENCIES_SANDBOX } from '#tests/data/checks/dependencies.ts';

test('Git download hosts need a reviewed allow-list entry, and HTTPS stays required', async () => {
    const insecureDownload = new URL(HOST_LOCKFILE.packages['node_modules/third'].resolved);
    insecureDownload.protocol = 'http:';
    const lockfile = {
        ...HOST_LOCKFILE,
        packages: {
            ...HOST_LOCKFILE.packages,
            'node_modules/third': { ...HOST_LOCKFILE.packages['node_modules/third'], resolved: insecureDownload.href },
        },
    };
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package-lock.json': JSON.stringify(lockfile, null, 2),
    });

    const failed = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['dependencies/lockfiles'] }),
    );

    expect(failed.report.checks.flatMap(({ findings }) => findings)).toHaveLength(3);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings([], {
            tables: `[dependencies]\nallowed_registries = { value = ["github.com", "codeload.github.com"], reason = ${JSON.stringify(SETTING_REASON)} }\n`,
        }),
    );
    const insecure = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['dependencies/lockfiles'] }),
    );

    expect(insecure.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        {
            file: 'package-lock.json',
            rule: 'host',
            message: `${insecureDownload.href} is not HTTPS.`,
        },
    ]);
    await writeFile(join(sandbox.path, 'package-lock.json'), JSON.stringify(HOST_LOCKFILE));
    const corrected = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['dependencies/lockfiles'] }),
    );

    expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('an allowed registry host applies only in its scope', async () => {
    const lockfile = JSON.stringify(HOST_LOCKFILE, null, 2);
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[scope]]\npath = "app"\n[scope.dependencies]\nallowed_registries = { value = ["github.com", "codeload.github.com"], reason = ${JSON.stringify(SETTING_REASON)} }\n[[scope]]\npath = "sibling"\n`,
        }),
        'package-lock.json': lockfile,
        'app/package-lock.json': lockfile,
        'sibling/package-lock.json': lockfile,
    });
    const isolated = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['dependencies/lockfiles'] }),
    );
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
});

test.each([...LOCKFILE_HOST_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    await using sandbox = await createSandbox(DEPENDENCIES_SANDBOX);
    const result = await runCheckSample(sandbox, entry, DEPENDENCIES_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
