import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { getTool } from '#cli/tools/pins.ts';
import { openSession } from '#cli/engine/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { buildToolProjects } from '#cli/generation/generate.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeNpmTool, fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

async function runBunInstall(root: string, installPackages: () => Promise<void>) {
    const session = await openSession(root);
    await createFileTree(root, buildToolLockfiles(session.toolConfigurations));
    using _lookup = fakeExecutableLookup((name) => (name === 'node' ? undefined : null));
    let installs = 0;
    using _commands = fakeCommands(undefined, async (command) => {
        if (!command.includes('install')) return buildProcessResult({ stdout: '1.4.2\n' });
        installs += 1;
        if (installs > 1) await installPackages();
        return buildProcessResult();
    });
    const result = await installTools(session, {
        writer: openFiles(root),
        generated: { files: buildToolProjects(session) },
        checkTools: listHostCheckTools(session.configuredChecks),
    });
    return { result, installs };
}

const BUN_SANDBOX = {
    'gspot.toml': buildSandboxSettings(['bash']),
    'entry.sh': 'echo example\n',
    'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
};

test('a tool that fails its inspection installs again in a fresh node_modules folder', async () => {
    await using sandbox = await createGitSandbox({
        ...BUN_SANDBOX,
        [`${GSPOT_PATHS.nodeModules}/stale.txt`]: 'stale',
    });
    const stale = join(sandbox.path, GSPOT_PATHS.nodeModules, 'stale.txt');
    const seen: boolean[] = [];
    const { result, installs } = await runBunInstall(sandbox.path, async () => {
        seen.push(existsSync(stale));
        await fakeNpmTool(sandbox.path, 'prettier');
    });
    expect(installs).toBe(2);
    expect(seen).toStrictEqual([false]);
    expect(result.missing.filter((line) => line.startsWith('prettier '))).toStrictEqual([]);
});

test('a tool that fails again is named with its reason', async () => {
    await using sandbox = await createGitSandbox(BUN_SANDBOX);
    const { result } = await runBunInstall(sandbox.path, () => Promise.resolve());
    const session = await openSession(sandbox.path);
    const prettier = getTool(session.toolConfigurations, 'prettier');
    expect(result.missing).toContain(
        `prettier ${String(prettier.version)} still fails after a forced install. gspot found no program`,
    );
});
