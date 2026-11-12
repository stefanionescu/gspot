import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree, type TestdirResult } from 'testdirs';

import { TOOLS_MISSING_MESSAGE } from '#cli/config/commands/setup.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { openSession } from '#cli/engine/session.ts';
import { GspotError } from '#cli/system/errors.ts';
import * as processes from '#cli/system/processes.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { FAILED_NPM_VERSION } from '#tests/config/commands/setup.ts';
import { installOutputSchema } from '#tests/schemas/setup.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildToolLockfiles } from '#tests/setup/cli/tools.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

async function createMarkdownSandbox(): Promise<TestdirResult> {
    const sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown']),
        'README.md': '# Example\n',
    });
    await applyGeneratedFiles(sandbox.path);
    return sandbox;
}

test('writing the generated files starts no npm, and install reports a failed npm version lookup', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    using npm = fakeCommands('npm', () => Promise.resolve(buildProcessResult(FAILED_NPM_VERSION)));
    await applyGeneratedFiles(sandbox.path);
    expect(npm).not.toHaveBeenCalled();
    const before = await readTree(sandbox.path);
    const structured = await runGspot(sandbox.path, ['install', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(JSON.parse(structured.stdout)).toMatchObject({
        error: 'install',
        message:
            'Cannot determine the npm version for the tool project. Check that npm --version runs in the repository, then run the command again.',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('an unexpected error during install prints the internal error once, its stack with --verbose, and changes nothing', async () => {
    await using sandbox = await createMarkdownSandbox();
    const before = await readTree(sandbox.path);
    const run = processes.runProcess;
    using _spawn = spyOn(processes, 'runProcess').mockImplementation(async (command, options) => {
        if (command[0] === 'git') return await run(command, options);
        if (command[0] === 'npm') throw new Error('Unexpected process failure.');
        return buildProcessResult();
    });
    const failed = await runGspot(sandbox.path, ['install', '--json']);
    expect(failed.code).toBe(2);
    expect(JSON.parse(failed.stdout)).toMatchObject({ error: 'unexpected' });
    expect(failed.stdout).not.toContain('Unexpected process failure.');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const verbose = await runGspot(sandbox.path, ['install', '--verbose', '--json']);
    expect(verbose.code).toBe(2);
    const { error, stack } = JSON.parse(verbose.stdout) as { error: string; stack: string };
    expect(error).toBe('unexpected');
    expect(stack).toContain('Unexpected process failure.');
});

test('install writes the tool projects again when an edit changed one', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });
    await applyGeneratedFiles(sandbox.path);
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

test('install writes the generated files, exits 1, and names the tools that stay missing', async () => {
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
    const report = installOutputSchema.parse(JSON.parse(result.stdout));
    expect(report.missing[0]).toContain('shfmt');
    const shellcheck = getManifestTarget('bash', 'shellcheckrc');
    expect(report.written).toContain(shellcheck);
    expect(existsSync(join(sandbox.path, shellcheck))).toBe(true);
});

test('install stopped by SIGINT reports cancellation once and exits 130', async () => {
    await using sandbox = await createMarkdownSandbox();
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
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'canceled' });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('an install that leaves a tool missing says so in its summary', async () => {
    await using sandbox = await createMarkdownSandbox();
    using _install = spyOn(installers, 'installTools').mockResolvedValue({
        installed: ['taplo'],
        missing: ['shfmt'],
        notes: [],
        steps: [],
    });
    const result = await runGspot(sandbox.path, ['install', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ summary: TOOLS_MISSING_MESSAGE });
});
