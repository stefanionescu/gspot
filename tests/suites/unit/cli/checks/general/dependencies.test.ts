import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { unlink, writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCheckSample, expectedSummary } from '#tests/setup/cli/samples.ts';

import {
    HOST_LOCKFILE,
    MISE_PIN_FILES,
    BUN_PROJECT_FILES,
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

test.each([...LOCKFILE_HOST_CASES])(
    'dependencies/lockfiles reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'dependencies/lockfiles', ...row };
        await using sandbox = await createSandbox(DEPENDENCIES_SANDBOX);
        expect(await runCheckSample(sandbox, sample)).toStrictEqual(expectedSummary(sample));
    },
);

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
        'bun.lockb': Buffer.concat([Buffer.from([0xff, 0]), Buffer.from('https://untrusted.invalid/package.tgz')]),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
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
        const findings = await runSandboxCheck(sandbox.path, 'dependencies/lockfiles');
        expect(findings.map(({ line }) => line)).toStrictEqual([...lines]);
    },
);

test.each([...MISE_PIN_FILES])(
    'package-manager-pin reports a packageManager that differs from the bun pin of $file, and passes once they match',
    async ({ file }) => {
        const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' });
        await using sandbox = await testdir({
            'package.json': packageJson,
            [file]: '[tools]\nbun = "0.0.0-test.2"\n',
            'gspot.toml': buildSandboxSettings(['javascript']),
        });
        const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
        expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual([
            {
                file: 'package.json',
                line: 1,
                rule: 'package-manager-pin',
                message: `packageManager names bun 0.0.0-test.1, but ${file} pins bun 0.0.0-test.2. Write one version in both.`,
            },
        ]);
        await writeFile(join(sandbox.path, 'package.json'), packageJson.replace('test.1', 'test.2'));
        expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
    },
);
test('package-manager-pin uses the highest-precedence mise file in a folder', async () => {
    await using sandbox = await testdir({
        ...Object.fromEntries(MISE_PIN_FILES.map(({ file }) => [file, '[tools]\nbun = "0.0.0-test.2"\n'])),
        '.mise.local.toml': '[tools]\nbun = "0.0.0-test.1"\n',
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});

test('stale-lockfile reports each dependency that package.json and bun.lock disagree on', async () => {
    await using sandbox = await testdir({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'package.json asks for zod ^4.1.0, but bun.lock records ^4.0.0. Run bun install and commit the lockfile.',
        'package.json declares typescript 5.9.3, which bun.lock does not record. Run bun install and commit the lockfile.',
        'bun.lock records left-pad, which package.json no longer declares. Run bun install and commit the lockfile.',
    ]);
});
