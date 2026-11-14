import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, parse } from 'node:path';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/engine/session.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { listHostCheckTools } from '#cli/engine/plan/tools.ts';
import { installTools } from '#cli/tools/installers/install.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getTool, listDistinctTools } from '#cli/manifests/tools.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { fakeNpmTool, buildToolLockfiles, fakeToolExecutables } from '#tests/setup/cli/tools.ts';

async function runBunInstall(root: string, installPackages: () => Promise<void>, damagedTool?: string) {
    const session = await openSession(root);
    await createFileTree(root, buildToolLockfiles(session.toolConfigurations));
    using _lookup = fakeExecutableLookup((name) => (name === 'node' ? undefined : null));
    let installs = 0;
    using _commands = fakeCommands(undefined, async (command) => {
        if (parse(command[0] ?? '').name === damagedTool) return buildProcessResult({ code: 1, stderr: 'damaged' });
        if (!command.includes('install')) return buildProcessResult({ stdout: '1.4.2\n' });
        installs += 1;
        if (installs > 1) await installPackages();
        return buildProcessResult();
    });
    const result = await installTools(session, { checkTools: listHostCheckTools(session) });
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
    const { result } = await runBunInstall(sandbox.path, async () => {
        seen.push(existsSync(stale));
        await fakeNpmTool(sandbox.path, 'prettier');
    });
    expect(seen).toStrictEqual([false]);
    expect(result.missing.filter((line) => line.startsWith('prettier '))).toStrictEqual([]);
});

test('a tool that cannot start fails its inspection, though its package names the pin', async () => {
    await using sandbox = await createGitSandbox(BUN_SANDBOX);
    await fakeNpmTool(sandbox.path, 'prettier');
    const { result } = await runBunInstall(
        sandbox.path,
        async () => {
            await fakeNpmTool(sandbox.path, 'prettier');
        },
        'prettier',
    );
    const session = await openSession(sandbox.path);
    const prettier = getTool(session.toolConfigurations, 'prettier');
    const named = result.missing.filter((line) => line.startsWith(`prettier ${String(prettier.version)} `));
    expect(named).toStrictEqual([expect.stringContaining('damaged') as string]);
});

test('a failed mise install stops the install after the npm tool project, which installs beside it', async () => {
    await using sandbox = await createGitSandbox(BUN_SANDBOX);
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, buildToolLockfiles(session.toolConfigurations));
    const programs = new Map([['mise', join(tmpdir(), 'test-tools', 'mise')]]);
    using _lookup = fakeExecutableLookup((name) => (name === 'node' ? undefined : (programs.get(name) ?? null)));
    const installs: string[][] = [];
    using _commands = fakeCommands(undefined, (command) => {
        if (command[1] === 'install') return Promise.resolve(buildProcessResult({ code: 1, stderr: 'mise failed' }));
        if (command.includes('install')) installs.push([...command]);
        return Promise.resolve(buildProcessResult({ stdout: '1.4.2\n' }));
    });
    const error = await captureRejection(installTools(session, { checkTools: listHostCheckTools(session) }));
    expect(error.message).toContain('mise failed');
    expect(
        installs.map((command) => command.slice(command.indexOf('--') + 1, command.indexOf('--') + 3)),
    ).toStrictEqual([['bun', 'install']]);
});

test('a second install with every tool in place runs no package manager', async () => {
    await using sandbox = await createGitSandbox(BUN_SANDBOX);
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, buildToolLockfiles(session.toolConfigurations));
    const tools = listDistinctTools(session.toolConfigurations);
    for (const tool of tools) if (tool.installers['npm'] !== undefined) await fakeNpmTool(sandbox.path, tool.name);
    const installs: string[][] = [];
    using _commands = fakeCommands('mise', (command) => {
        if (command.includes('install')) installs.push([...command]);
        return Promise.resolve(buildProcessResult({ stdout: '1.4.2\n' }));
    });
    using _executables = fakeToolExecutables(tools.filter((tool) => tool.installers.mise !== undefined));
    const input = { checkTools: listHostCheckTools(session) };
    await installTools(session, input);
    expect(installs).toHaveLength(1);
    const second = await installTools(session, input);
    expect(installs).toHaveLength(1);
    expect(second.missing).toStrictEqual([]);
});
