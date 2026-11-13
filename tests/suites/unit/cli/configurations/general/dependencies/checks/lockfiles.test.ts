import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import {
    ALLOWED_GITHUB_REGISTRIES,
    HOST_LOCKFILE,
    LOCKFILE_DOWNLOAD_CASES,
    LOCKFILE_HOST_CASES,
    REGISTRY_SCOPE_RESULTS,
} from '#tests/config/configurations/dependencies.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('dependencies/lockfiles accepts a vendored file tarball without treating it as a download', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package-lock.json': '{"packages":{"node_modules/vendored":{"resolved":"file:vendor/vendored-1.0.0.tgz"}}}',
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
});

test('dependencies/lockfiles reports Git download hosts until they are allowed, and an http: download even when its host is allowed', async () => {
    const insecureDownload = new URL(HOST_LOCKFILE.packages['node_modules/third'].resolved);
    insecureDownload.protocol = 'http:';
    const lockfile = {
        ...HOST_LOCKFILE,
        packages: {
            ...HOST_LOCKFILE.packages,
            'node_modules/third': { ...HOST_LOCKFILE.packages['node_modules/third'], resolved: insecureDownload.href },
        },
    };
    await using sandbox = await createGitSandbox({
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
            message: expect.stringContaining(insecureDownload.href) as string,
        },
    ]);
});

test.each([...LOCKFILE_HOST_CASES])(
    'dependencies/lockfiles reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'dependencies/lockfiles', ...row };
        await using sandbox = await createSandbox({
            configurations: ['dependencies'],
            files: {
                'package.json': '{"name":"example","version":"1.0.0","private":true,"packageManager":"bun@1.4.2"}\n',
            },
        });
        await assertCheckSample(sandbox, sample);
    },
);

test('an allowed registry host in a scope applies only to that scope', async () => {
    const lockfile = JSON.stringify(HOST_LOCKFILE, null, 2);
    await using sandbox = await createGitSandbox({
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

test('dependencies/lockfiles reports the lockfile of a second package manager in the scope as foreign-lockfile', async () => {
    await using sandbox = await createGitSandbox({
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
            message: expect.stringContaining('package-lock.json, yarn.lock') as string,
        }),
    ]);
});

test("dependencies/lockfiles leaves gspot's own tool lockfile out of the scope", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'package.json': '{"private":true}\n',
        'package-lock.json': '{"lockfileVersion":3,"packages":{}}\n',
        '.gspot/pnpm-lock.yaml':
            "lockfileVersion: '9.0'\npackages:\n  a@1.0.0:\n    resolution: {tarball: http://untrusted.invalid/a.tgz}\n",
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
});

test.each([...LOCKFILE_DOWNLOAD_CASES])(
    '$path checks download fields without treating metadata URLs as registries: $name',
    async ({ path, text, lines }) => {
        await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]), [path]: text });
        const findings = await runSandboxCheck(sandbox.path, 'dependencies/lockfiles');
        expect(findings.map(({ line }) => line)).toStrictEqual([...lines]);
    },
);
