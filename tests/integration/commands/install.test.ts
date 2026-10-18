import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { INIT_FILES } from '#tests/data/commands/init.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/edit-settings.ts';
import { PACKAGE_MANAGER_ROWS } from '#tests/data/install/npm-tool-project.ts';
import { buildSandboxPath, installToolProjects } from '#tests/setup/install.ts';
import { createPackageManagerSandbox } from '#tests/setup/package-manager-sandboxes.ts';

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

test('install refuses an npm tool project edited to run scripts, before it contacts the registry', async () => {
    await using sandbox = await createPackageManagerSandbox(...PACKAGE_MANAGER_ROWS[0]);
    const { root, registry } = sandbox;
    const manifestPath = join(root, '.gspot/package.json');
    const manifest = await readFile(manifestPath);
    await chmod(manifestPath, 0o644);
    const hasScript = JSON.stringify({
        ...JSON.parse(Buffer.from(manifest).toString('utf8')),
        scripts: { postinstall: 'exit 42' },
    });
    await writeFile(manifestPath, hasScript);
    const requests = registry.requests;
    const refused = await spawnGspot(root, ['install', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toContain('Run gspot apply first');
    expect(registry.requests).toBe(requests);
    expect(await readFile(manifestPath, 'utf8')).toBe(hasScript);
});
