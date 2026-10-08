import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { CLI_PINS } from '#cli/config/pins.ts';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { initCommand } from '#cli/commands/init/public.ts';
import { installCommand } from '#cli/commands/contracts.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { buildPolicy, alwaysSelectedConfigurations } from '#tests/harness/policy.ts';
import { INSTALLATION_FAILURES } from '#tests/config/cli/lifecycle/installer-failures.ts';

const { version: RUNNING_VERSION } = packageManifest;

test.each([...INSTALLATION_FAILURES])(
    'init preserves a usable configuration when mise is $availability and install reports the remaining work',
    async ({ exitCode, failsOn, version, retryMessage: retryDiagnostic }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': 'Authored project.\n' });
        const run = processes.run;
        let isRepaired = false;
        using _installer = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'mise') return run(command, options);
            const failed = !isRepaired && (failsOn === 'every call' || command[1] === failsOn);
            const code = failed ? exitCode : 0;
            return Promise.resolve({
                code,
                missing: code === 127,
                duration: 0,
                stdout: `mise ${isRepaired ? CLI_PINS.mise.version : version}`,
                stderr: '',
            });
        });
        const result = await initCommand(
            buildInitOptions(sandbox.path, {
                configurations: ['none'],
                runner: 'mise',
                install: true,
            }),
        );
        expect(result.exitCode).toBe(2);
        expect(result.json).toMatchObject({ error: 'installation', message: textContaining('Run: gspot install') });
        expect(result.text).toContain('Tool installation is incomplete');
        expect(result.text).toContain('Run: gspot install');
        const recordedVersion = await readFile(join(sandbox.path, '.gspot/version'), 'utf8');
        expect(recordedVersion.trim()).toBe(RUNNING_VERSION);
        const session = await openSession(sandbox.path);
        expect(session.policyFiles.policy.configurations).toStrictEqual(
            [...alwaysSelectedConfigurations(), 'format'].toSorted((a, b) => a.localeCompare(b)),
        );
        expect(await readFile(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
        const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(retry.exitCode).toBe(2);
        expect(retry.text).toContain(retryDiagnostic);
        const policy = await readFile(join(sandbox.path, 'gspot.toml'));
        isRepaired = true;
        const repaired = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(repaired.exitCode, repaired.text).toBe(0);
        expect(await readFile(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
    },
);

test('init does not report success when required Python lockfile creation cannot run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'main.py': 'print("authored")\n',
        'pyrightconfig.json': '{"exclude":["legacy"]}\n',
    });
    const run = processes.run;
    using _installer = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] === 'mise')
            return Promise.resolve({
                code: 0,
                missing: false,
                duration: 0,
                stdout: command[1] === 'which' ? 'uv' : '',
                stderr: '',
            });
        return command[0] === 'uv'
            ? Promise.resolve({ code: 127, missing: true, duration: 0, stdout: '', stderr: '' })
            : run(command, options);
    });
    expect(
        await rejection(
            initCommand(
                buildInitOptions(sandbox.path, {
                    configurations: ['python'],
                    runner: 'mise',
                    install: true,
                }),
            ),
        ),
    ).toContain('uv is unavailable. Run: python -m pip install uv==');
    expect(await readFile(join(sandbox.path, 'main.py'), 'utf8')).toBe('print("authored")\n');
    expect(await pathExists(join(sandbox.path, '.gspot/uv.lock'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'pyrightconfig.json'), 'utf8')).toBe('{"exclude":["legacy"]}\n');
});

test('a repository that already runs hooks keeps them, gets the gspot lines, and the other installers still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: 'runner = "mise"\n[hooks]\nenabled = true\n[agent_rules]\nenabled = false\n',
        }),
        '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    gitOutput(sandbox.path, ['init', '--quiet']);
    gitOutput(sandbox.path, ['config', 'core.hooksPath', '.githooks']);
    {
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(await openSession(sandbox.path), log);
    }
    const read: string[][] = [];
    const run = processes.run;
    using _installer = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'mise') return run(command, options);
        read.push([...command]);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 0,
            stdout: `mise ${CLI_PINS.mise.version}`,
            stderr: '',
        });
    });
    const result = await installCommand({ cwd: sandbox.path, isDryRun: false });
    expect(result.exitCode, result.text).toBe(0);
    expect(result.text).toContain('add these gspot lines');
    expect(result.text).toContain('pre-commit: mise exec -- gspot check --hook pre-commit');
    expect(read).toContainEqual(['mise', 'install']);
    expect(gitOutput(sandbox.path, ['config', 'core.hooksPath'])).toBe('.githooks');
});
