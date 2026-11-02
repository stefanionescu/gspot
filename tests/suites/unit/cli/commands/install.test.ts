import { join } from 'node:path';
import { createFileTree } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import type { InstallCommandJson } from '#cli/types/commands/edits.ts';
import { FAILED_NPM_VERSION } from '#tests/config/commands/reports.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';

test('apply starts no npm, and install reports a failed npm version lookup', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    using npm = fakeCommands('npm', () => Promise.resolve(buildProcessResult(FAILED_NPM_VERSION)));
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(npm).not.toHaveBeenCalled();
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
    const run = processes.runProcess;
    using _spawn = spyOn(processes, 'runProcess').mockImplementation(async (command, options) => {
        if (command[0] === 'git') return await run(command, options);
        if (command[0] === 'npm') throw new Error('Unexpected process failure.');
        return buildProcessResult();
    });
    const message =
        'gspot stopped because of an internal error. Report it at https://github.com/stefanionescu/gspot/issues.';
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(JSON.parse(failed.stdout)).toMatchObject({ error: 'unexpected', message });
    expect(failed.stdout).not.toContain('Unexpected process failure.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('install writes the tool projects again when an edit changed one', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const project = join(sandbox.path, GSPOT_PATHS.miseProject);
    const generated = await readFile(project, 'utf8');
    await writeFile(project, '[tools]\n');
    using _commands = fakeCommands(undefined, (command) => {
        if (command[1] === 'lock') throw new GspotError('install', 'The test stops at the first tool.');
        return Promise.resolve(buildProcessResult({ stdout: '11.19.0\n' }));
    });
    await runGspot(sandbox.path, ['install', '--json']);
    expect(await readFile(project, 'utf8')).toBe(generated);
});

test('install exits 1 and names the tools that stay missing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
        'package.json': '{"private":true,"packageManager":"bun@1.4.2"}',
    });
    const session = await openSession(sandbox.path);
    await createFileTree(sandbox.path, buildToolLockfiles(session.toolConfigurations));
    using _lookup = fakeExecutableLookup((name) => (name === 'node' ? undefined : null));
    using _commands = fakeCommands(undefined, () => Promise.resolve(buildProcessResult({ stdout: '1.4.2\n' })));
    const result = await runGspot(sandbox.path, ['install', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as InstallCommandJson;
    expect(report.missing[0]).toStartWith('Install mise, or install these tools yourself: ');
    expect(report.missing[0]).toContain('shfmt');
});

test('install stopped by SIGINT reports cancellation once and exits 130', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const before = await readTree(sandbox.path);
    const run = processes.runProcess;
    using _spawn = spyOn(processes, 'runProcess').mockImplementation(async (command, options) => {
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
