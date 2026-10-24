import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { unlink, writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    HOST_LOCKFILE,
    BINARY_BUN_LOCKFILE,
    LOCKFILE_HOST_CASES,
    DEPENDENCIES_SANDBOX,
    REGISTRY_SCOPE_RESULTS,
    LOCKFILE_DOWNLOAD_CASES,
    ALLOWED_GITHUB_REGISTRIES,
} from '#tests/config/checks/general/dependencies.ts';

test('dependencies/lockfiles accepts a vendored file tarball without treating it as a download', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        'package-lock.json': '{"packages":{"node_modules/vendored":{"resolved":"file:vendor/vendored-1.0.0.tgz"}}}',
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
});

test('dependencies/lockfiles reports Git download hosts until they are allowed, and plain HTTP even when allowed', async () => {
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

    expect(listFindingRows(failed.report)).toStrictEqual([
        { file: 'package-lock.json', line: 4, rule: 'host' },
        { file: 'package-lock.json', line: 7, rule: 'host' },
        { file: 'package-lock.json', line: 10, rule: 'host' },
    ]);
    expect(failed.report.checks.flatMap(({ findings }) => findings.map(({ message }) => message))).toStrictEqual([
        'github.com is not an allowed registry host.',
        'codeload.github.com is not an allowed registry host.',
        `${insecureDownload.href} is not HTTPS.`,
    ]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings([], { tables: `[dependencies]\n${ALLOWED_GITHUB_REGISTRIES}` }),
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
test.each([...LOCKFILE_HOST_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await using sandbox = await createSandbox(DEPENDENCIES_SANDBOX);
    const result = await runCheckSample(sandbox, sample, DEPENDENCIES_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(sample));
});
test('an allowed registry host in a scope applies only to that scope', async () => {
    const lockfile = JSON.stringify(HOST_LOCKFILE, null, 2);
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], {
            tables: `[[scope]]\npath = "app"\n[scope.dependencies]\n${ALLOWED_GITHUB_REGISTRIES}[[scope]]\npath = "sibling"\n`,
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
    ).toStrictEqual([...REGISTRY_SCOPE_RESULTS]);
});
test('dependencies/lockfiles reads no hosts from the binary bun.lockb', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'bun.lockb': BINARY_BUN_LOCKFILE,
    });
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'dependencies/lockfiles');
    expect(await findBuiltInCheck('dependencies/lockfiles')(session, planned)).toStrictEqual([]);
});

test('dependencies/lockfiles reports the lockfile of a second package manager in the scope as foreign-lockfile', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'package.json': '{"private":true}\n',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}\n',
        'yarn.lock': '# yarn lockfile v1\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([
        matchFields({
            file: 'yarn.lock',
            line: 1,
            rule: 'foreign-lockfile',
            message: 'This scope holds lockfiles of 2 package managers: package-lock.json, yarn.lock. Keep one.',
        }),
    ]);
    await unlink(join(sandbox.path, 'yarn.lock'));
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
});

test.each([...LOCKFILE_DOWNLOAD_CASES])(
    '$path checks download fields without treating metadata URLs as registries',
    async ({ path, text, lines }) => {
        await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([]), [path]: text });
        const checked = await runSandboxCheck(sandbox.path, 'dependencies/lockfiles');
        expect(checked.map(({ line }) => line)).toStrictEqual([...lines]);
    },
);
