import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { getTool } from '#cli/tools/pins.ts';
import { runChecks } from '#cli/engine/run.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { unlink, writeFile } from 'node:fs/promises';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { BUN_PROJECT_FILES } from '#tests/config/configurations/general.ts';
import { fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';

import {
    HOST_LOCKFILE,
    MISE_PIN_FILES,
    BUN_PIN_SETTINGS,
    LOCKFILE_HOST_CASES,
    DEPENDENCIES_SANDBOX,
    REGISTRY_SCOPE_RESULTS,
    LOCKFILE_DOWNLOAD_CASES,
    ALLOWED_GITHUB_REGISTRIES,
} from '#tests/config/configurations/dependencies.ts';

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

test('dependencies/lockfiles reads no hosts from the binary bun.lockb', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'bun.lockb': Buffer.concat([Buffer.from([0xff, 0]), Buffer.from('https://untrusted.invalid/package.tgz')]),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
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
            message: 'This scope holds lockfiles of 2 package managers: package-lock.json, yarn.lock. Keep one.',
        }),
    ]);
    await unlink(join(sandbox.path, 'yarn.lock'));
    expect(await runSandboxCheck(sandbox.path, 'dependencies/lockfiles')).toStrictEqual([]);
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

test.each([...MISE_PIN_FILES])(
    'package-manager-pin reports a packageManager that differs from the bun pin of $file, and passes once they match',
    async ({ file }) => {
        const packageJson = JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' });
        await using sandbox = await createGitSandbox({
            'package.json': packageJson,
            [file]: BUN_PIN_SETTINGS,
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

test.each(['mise.toml', '.config/mise.toml'])('a staged %s alone plans package-manager-pin', async (file) => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ name: 'shop', private: true }),
        [file]: BUN_PIN_SETTINGS,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const session = await openSession(sandbox.path);
    const [planned] = planChecks(session, {
        stage: 'commit',
        selection: { content: 'index', paths: [file] },
        only: ['dependencies/package-manager-pin'],
    });
    expect(planned?.files.map(({ path }) => path)).toContain(file);
});

test('package-manager-pin gives the line to add beside a pnpm lockfile, with the mise version', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': JSON.stringify({ name: 'shop', private: true }),
        'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        'mise.toml': '[tools]\npnpm = "10.30.0"\n',
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'CI installs only a pinned pnpm. Add "packageManager": "pnpm@10.30.0" to package.json.',
    ]);
});

test('package-manager-pin uses the highest-precedence mise file in a folder', async () => {
    await using sandbox = await createGitSandbox({
        ...Object.fromEntries(MISE_PIN_FILES.map(({ file }) => [file, BUN_PIN_SETTINGS])),
        '.mise.local.toml': '[tools]\nbun = "0.0.0-test.1"\n',
        'package.json': JSON.stringify({ name: 'shop', private: true, packageManager: 'bun@0.0.0-test.1' }),
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    expect(await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin')).toStrictEqual([]);
});

test('stale-lockfile reports each dependency that package.json and bun.lock disagree on', async () => {
    await using sandbox = await createGitSandbox({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile');
    expect(findings.map(({ message }) => message)).toStrictEqual([
        'package.json asks for zod ^4.1.0, but bun.lock records ^4.0.0. Run bun install and commit the lockfile.',
        'package.json declares typescript 0.0.0-test, which bun.lock does not record. Run bun install and commit the lockfile.',
        'bun.lock records left-pad, which package.json no longer declares. Run bun install and commit the lockfile.',
    ]);
});

test('package-manager-pin reports malformed mise syntax and still reads other mise files', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"packageManager":"bun@1.0.0"}',
        'mise.toml': '[tools',
        '.mise.toml': '[tools]\nbun = "2.0.0"\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/package-manager-pin');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'mise.toml', rule: 'syntax' },
        { file: 'package.json', rule: 'package-manager-pin' },
    ]);
});

test('osv-scanner reads each lockfile of the repository at any size, apart from ignored folders and the files of gspot', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: '[repository]\nmax_file_kilobytes = 0\n' }),
        'uv.lock': 'version = 1\n',
        'app/requirements.txt': '',
        '.gspot/bun.lock': '',
        '.claude/worktrees/copy/uv.lock': '',
        '.claude/worktrees/copy/.gspot/bun.lock': '',
    });
    await writeFile(join(sandbox.path, '.git/info/exclude'), '.claude/worktrees/\n');
    await applyGeneratedFiles(sandbox.path);
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'osv-scanner')]);
    using _spawn = fakeCommands('osv-scanner', (command, options) => {
        const results = command
            .filter((argument) => argument.startsWith('--lockfile=:'))
            .map((argument) => ({
                source: { path: join(options.cwd, argument.slice('--lockfile=:'.length)), type: 'lockfile' },
                packages: [
                    {
                        package: { name: 'django', version: '2.0.0', ecosystem: 'PyPI' },
                        vulnerabilities: [{ id: 'GHSA-1', summary: 'Denial of service.' }],
                    },
                ],
            }));
        return Promise.resolve(buildProcessResult({ code: 1, stdout: JSON.stringify({ results }) }));
    });
    const findings = await runSandboxCheck(sandbox.path, 'dependencies/osv-scanner');
    expect(findings.map(({ file }) => file)).toStrictEqual(['app/requirements.txt', 'uv.lock']);
});

test('stale-lockfile reports a peer dependency and an unrecorded workspace importer', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { scopes: [{ path: 'packages/app', configurations: [] }] }),
        'package.json': '{"workspaces":["packages/*"],"peerDependencies":{"react":"^19.0.0"}}',
        'packages/app/package.json': '{"name":"app","dependencies":{"zod":"^4.0.0"}}',
        'package-lock.json': '{"lockfileVersion":3,"packages":{"":{}}}',
    });
    expect([
        ...(await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile')),
        ...(await runSandboxCheck(sandbox.path, 'dependencies/stale-lockfile', { scope: 'packages/app' })),
    ]).toMatchObject([
        { file: 'package.json', rule: 'stale-lockfile' },
        { file: 'packages/app/package.json', rule: 'stale-lockfile' },
    ]);
});
