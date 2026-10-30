import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as processes from '#cli/system/processes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import * as installation from '#cli/installers/install.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { TOOL_PROJECTS_MESSAGE } from '#tests/config/messages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { FAILED_NPM_VERSION, OUTDATED_TOOL_PROJECTS } from '#tests/config/commands/install.ts';

test('apply starts no npm, and install reports a failed npm version lookup in text and JSON', async () => {
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
    const human = await runGspot(sandbox.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Cannot determine the npm version for the tool project.\n');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, ['install', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'install',
        message: 'Cannot determine the npm version for the tool project.',
    });
    expect(boundary).toHaveBeenCalledWith(['npm', '--version'], expect.objectContaining({ cwd: sandbox.path }));
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
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation((command) =>
        command[0] === 'npm'
            ? Promise.reject(new Error('Unexpected process failure.'))
            : Promise.resolve(buildProcessResult()),
    );
    const human = await runGspot(sandbox.path, ['install']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    const message =
        'gspot stopped because of an internal error: Unexpected process failure. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.';
    expect(human.stderr).toBe(`${message}\n`);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(failed.stderr).toBe('');
    expect(JSON.parse(failed.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 2,
        notes: [],
        error: 'unexpected',
        message,
    });
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
        expect(JSON.parse(refused.stdout)).toStrictEqual({
            version: cliPackage.version,
            exitCode: 2,
            notes: [],
            error: 'install',
            message: TOOL_PROJECTS_MESSAGE,
        });
        expect(spawned).not.toHaveBeenCalled();
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
    const listeners = process.listenerCount('SIGINT');
    using _spawn = spyOn(processes, 'spawnProcess').mockImplementation((_command, options) => {
        process.emit('SIGINT');
        expect(options.cancelSignal?.aborted).toBe(true);
        return Promise.reject(new Error('Installation canceled.'));
    });
    const result = await runGspot(sandbox.path, ['install', '--json']);
    expect(result.code).toBe(130);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 130,
        notes: [],
        error: 'canceled',
        message: 'Installation stopped before every tool was installed.',
    });
    expect(process.listenerCount('SIGINT')).toBe(listeners);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('install puts what it installed in the summary and the instructions in the notes', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    using installed = spyOn(installation, 'installTools').mockResolvedValue({
        installed: ['installed 2 npm tools in .gspot/node_modules', 'set core.hooksPath to .gspot/hooks'],
        notes: ['Install mise, or install these tools yourself: shfmt 3.0.0'],
        steps: [],
    });
    const text = await runGspot(sandbox.path, ['install']);
    expect(text).toStrictEqual({
        code: 0,
        stdout: 'installed 2 npm tools in .gspot/node_modules\nset core.hooksPath to .gspot/hooks\nInstall mise, or install these tools yourself: shfmt 3.0.0\n',
        stderr: '',
    });
    const result = await runGspot(sandbox.path, ['install', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        version: cliPackage.version,
        exitCode: 0,
        notes: ['Install mise, or install these tools yourself: shfmt 3.0.0'],
        summary: 'installed 2 npm tools in .gspot/node_modules\nset core.hooksPath to .gspot/hooks',
        steps: [],
    });
    expect(installed).toHaveBeenCalledTimes(2);
});
