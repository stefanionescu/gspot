import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { TOOL_PROJECTS_MESSAGE } from '#tests/config/messages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { FAILED_NPM_VERSION, OUTDATED_TOOL_PROJECTS } from '#tests/config/commands/install.ts';

test('apply starts no npm, and install reports a failed npm version lookup', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    const run = processes.spawnProcessBlocking;
    using boundary = spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) => {
        return command[0] === 'npm' && command[1] === '--version'
            ? buildProcessResult(FAILED_NPM_VERSION)
            : run(command, options);
    });
    using spawned = spyOn(processes, 'spawnProcess');
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const npmCalls = [...boundary.mock.calls, ...spawned.mock.calls].filter(([command]) =>
        /(?:^|[\\/])npm(?:\.cmd)?$/u.test(command[0] ?? ''),
    );
    expect(npmCalls).toStrictEqual([]);
    const before = await readTree(sandbox.path);
    const structured = await runGspot(sandbox.path, ['install', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(JSON.parse(structured.stdout)).toMatchObject({
        error: 'install',
        message: 'Cannot determine the npm version for the tool project.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('an unexpected error during install prints the internal error once and changes nothing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });

    const applied = await runGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const before = await readTree(sandbox.path);
    const run = processes.spawnProcess;
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation(async (command, options) => {
        if (command[0] === 'git') return await run(command, options);
        if (command[0] === 'npm') throw new Error('Unexpected process failure.');
        return buildProcessResult();
    });
    const message =
        'gspot stopped because of an internal error: Unexpected process failure. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.';
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(JSON.parse(failed.stdout)).toMatchObject({ error: 'unexpected', message });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([...OUTDATED_TOOL_PROJECTS])(
    'install refuses $name before it runs a tool, and changes nothing',
    async ({ path, text }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['bash']),
            'entry.sh': 'echo example\n',
        });
        const applied = await runGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await writeFile(join(sandbox.path, path), text);
        const before = await readTree(sandbox.path);
        using spawned = spyOn(processes, 'spawnProcess');
        const refused = await runGspot(sandbox.path, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(JSON.parse(refused.stdout)).toMatchObject({ error: 'install', message: TOOL_PROJECTS_MESSAGE });
        expect(spawned.mock.calls.filter(([command]) => command[0] !== 'git')).toStrictEqual([]);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('install stopped by SIGINT reports cancellation once and exits 130', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const before = await readTree(sandbox.path);
    const run = processes.spawnProcess;
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation(async (command, options) => {
        if (command[0] === 'git') return await run(command, options);
        process.emit('SIGINT');
        expect(options.cancelSignal?.aborted).toBe(true);
        throw new Error('Installation canceled.');
    });
    const result = await runGspot(sandbox.path, ['install', '--json']);
    expect(result.code).toBe(130);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'canceled',
        message: 'Installation stopped before every tool was installed.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
