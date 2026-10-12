import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { INIT_FILES } from '#tests/config/init.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { NPM_CLIENT_ROWS } from '#tests/config/npm.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { installCommand } from '#cli/commands/install.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { installNpmTools } from '#cli/tools/npm/project.ts';
import { createNpmClientSandbox } from '#tests/setup/npm-clients.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/save-settings.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { toolsPath, installToolProjects, readToolProjectFiles, expectRefusedInstall } from '#tests/setup/install.ts';

test('after init and install, apply has nothing to write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INIT_FILES);
    commitAll(sandbox.path);
    const environment = { PATH: toolsPath() };
    const init = await spawnGspot(sandbox.path, buildInitArguments([]), environment);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect((JSON.parse(applied.stdout) as DryRunJson).drift).toStrictEqual([]);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
});

test.each(['missing', 'stale'] as const)(
    'installing the npm tool project refuses a %s lockfile and installs nothing',
    async (state) => {
        await using sandbox = await createNpmClientSandbox('npm', 'package.json');
        const installed = await installCommand(sandbox.root);
        expect(installed.exitCode, installed.text).toBe(0);
        const { lockfilePath, lockfile, ownershipPath, ownership } = await readToolProjectFiles(sandbox.root, 'npm');
        if (state === 'missing') await unlink(lockfilePath);
        else {
            await chmod(lockfilePath, 0o644);
            await writeFile(
                lockfilePath,
                Buffer.from(lockfile).toString('utf8').replaceAll(prettierManifest.version, '0.0.0'),
            );
        }
        await expectRefusedInstall(sandbox.root, sandbox.tools, 'Run: gspot install', sandbox.registry);
        expect(await readFile(ownershipPath)).toStrictEqual(Buffer.from(ownership));
    },
);

test('npm from package.json refuses install scripts before contacting the registry', async () => {
    await using sandbox = await createNpmClientSandbox(...NPM_CLIENT_ROWS[0]);
    const { root, registry, tools } = sandbox;
    const manifestPath = join(root, '.gspot/package.json');
    const manifest = await readFile(manifestPath);
    await chmod(manifestPath, 0o644);
    const hasScript = JSON.stringify({
        ...JSON.parse(Buffer.from(manifest).toString('utf8')),
        scripts: { postinstall: 'exit 42' },
    });
    await writeFile(manifestPath, hasScript);
    await expectRefusedInstall(root, tools, 'scripts', registry);
    expect(await readFile(manifestPath, 'utf8')).toBe(hasScript);
});

test('a failed program download of an npm wrapper keeps the lockfile and installs nothing', async () => {
    await using sandbox = await createNpmClientSandbox('npm', 'package.json');
    const { root, tools } = sandbox;
    const installed = await installCommand(root);
    expect(installed.exitCode, installed.text).toBe(0);
    const { lockfilePath, lockfile } = await readToolProjectFiles(root, 'npm');
    const original = processes.run;
    using mockResources = new DisposableStack();
    mockResources.use(
        spyOn(processes, 'run').mockImplementation(async (argv, options, output) => {
            if (/(?:editorconfig-checker|[\\/]ec(?:\.cmd)?$)/u.test(argv[0] ?? ''))
                return {
                    code: 7,
                    stdout: '',
                    stderr: 'Native wrapper download failed',
                    missing: false,
                    duration: 1,
                };
            return original(argv, options, output);
        }),
    );
    using owner = openOwnershipLog(root);
    const session = await openSession(root);
    expect(await rejection(installNpmTools(session, owner.files, tools, []))).toContain(
        'Native wrapper download failed',
    );
    expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
});
