import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { INIT_FILES } from '#tests/data/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/edit-settings.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_MANAGER_ROWS } from '#tests/data/tools/npm-tool-project.ts';
import { createPackageManagerSandbox } from '#tests/setup/package-manager-sandboxes.ts';

import {
    buildSandboxPath,
    installToolProjects,
    readToolProjectFiles,
    captureInstallRefusal,
} from '#tests/setup/install.ts';

test('after init and install, apply has nothing to write', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, INIT_FILES);
    commitAll(sandbox.path);
    const environment = { PATH: buildSandboxPath() };
    const init = await spawnGspot(sandbox.path, buildInitArguments([]), environment);
    expect(init.code, init.stdout + init.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply', '--dry-run', '--json']);
    expect((JSON.parse(applied.stdout) as DryRunJson).stale).toStrictEqual([]);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
});

test.each(['missing', 'stale'] as const)(
    'installing the npm tool project refuses a %s lockfile and installs nothing',
    async (state) => {
        await using sandbox = await createPackageManagerSandbox('npm', 'package.json');
        const installed = await spawnGspot(sandbox.root, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const { lockfilePath, lockfile } = await readToolProjectFiles(sandbox.root, 'npm');
        if (state === 'missing') await unlink(lockfilePath);
        else {
            await chmod(lockfilePath, 0o644);
            await writeFile(
                lockfilePath,
                Buffer.from(lockfile).toString('utf8').replaceAll(prettierManifest.version, '0.0.0'),
            );
        }
        const refusal = await captureInstallRefusal(sandbox.root, sandbox.tools, sandbox.registry);
        expect(refusal.message).toContain('Run: gspot install');
        expect(refusal.requests).toBe(0);
    },
);

test('npm from package.json refuses install scripts before contacting the registry', async () => {
    await using sandbox = await createPackageManagerSandbox(...PACKAGE_MANAGER_ROWS[0]);
    const { root, registry, tools } = sandbox;
    const manifestPath = join(root, '.gspot/package.json');
    const manifest = await readFile(manifestPath);
    await chmod(manifestPath, 0o644);
    const hasScript = JSON.stringify({
        ...JSON.parse(Buffer.from(manifest).toString('utf8')),
        scripts: { postinstall: 'exit 42' },
    });
    await writeFile(manifestPath, hasScript);
    const refusal = await captureInstallRefusal(root, tools, registry);
    expect(refusal.message).toContain('scripts');
    expect(refusal.requests).toBe(0);
    expect(await readFile(manifestPath, 'utf8')).toBe(hasScript);
});
