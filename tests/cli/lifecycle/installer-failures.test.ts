import { join, delimiter } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { CLI_PINS } from '#cli/config/configurations.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { installCommand } from '#cli/commands/install.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { rm, chmod, readFile, writeFile } from 'node:fs/promises';
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
        const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'mise') return run(command, options);
            const failed = !isRepaired && (failsOn === 'every call' || command[1] === failsOn);
            const code = failed ? exitCode : 0;
            return Promise.resolve({
                code,
                missing: code === 127,
                duration: 0,
                stdout: `mise ${isRepaired ? CLI_PINS.mise : version}`,
                stderr: '',
            });
        });
        try {
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
            const version = await readFile(join(sandbox.path, '.gspot/version'), 'utf8');
            expect(version.trim()).toBe(RUNNING_VERSION);
            const session = await openSession(sandbox.path);
            expect(session.policyFiles.policy.configurations).toStrictEqual(alwaysSelectedConfigurations());
            expect(await readFile(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
            const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(retry.exitCode).toBe(2);
            expect(retry.text).toContain(retryDiagnostic);
            const policy = await readFile(join(sandbox.path, 'gspot.toml'));
            isRepaired = true;
            const repaired = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(repaired.exitCode, repaired.text).toBe(0);
            expect(await readFile(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
        } finally {
            installer.mockRestore();
        }
    },
);

test('init does not report success when required Python lockfile creation cannot run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'main.py': 'print("authored")\n',
        'pyrightconfig.json': '{"exclude":["legacy"]}\n',
    });
    const run = processes.run;
    const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
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
    try {
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
    } finally {
        installer.mockRestore();
    }
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
        writeOutputs(await openSession(sandbox.path), log);
    }
    const read: string[][] = [];
    const run = processes.run;
    const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'mise') return run(command, options);
        read.push([...command]);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 0,
            stdout: `mise ${CLI_PINS.mise}`,
            stderr: '',
        });
    });
    try {
        const result = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(result.exitCode, result.text).toBe(0);
        expect(result.text).toContain('add these gspot lines');
        expect(result.text).toContain('pre-commit: mise exec -- gspot check --hook pre-commit');
        expect(read).toContainEqual(['mise', 'install']);
        expect(gitOutput(sandbox.path, ['config', 'core.hooksPath'])).toBe('.githooks');
    } finally {
        installer.mockRestore();
    }
});

// The hook is a POSIX shell script that a POSIX PATH runs directly.
if (isPosix) {
    test.each(['missing', 'not executable'])(
        'an installed hook reports setup failure when its gspot launcher is %s',
        async (condition) => {
            await using repository = await testdir();
            await createFileTree(repository.path, {
                'gspot.toml': buildPolicy([], { tables: '[hooks]\nenabled = true\n[agent_rules]\nenabled = false\n' }),
                'bin/gspot': '#!/bin/sh\nexit 0\n',
            });
            gitOutput(repository.path, ['init', '-q']);
            {
                using log = openOwnership(repository.path);
                writeOutputs(await openSession(repository.path), log);
            }
            const launcher = join(repository.path, 'bin/gspot');
            await (condition === 'missing' ? rm(launcher) : chmod(launcher, 0o644));
            const hook = join(repository.path, '.gspot/hooks/pre-commit');
            const options = {
                cwd: repository.path,
                env: { PATH: `${join(repository.path, 'bin')}${delimiter}/usr/bin${delimiter}/bin` },
            };
            const failed = await processes.run([hook], options);
            expect(failed.code, failed.stdout + failed.stderr).toBe(2);
            expect(failed.stderr).toContain('gspot install');
            await writeFile(launcher, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
            await chmod(launcher, 0o755);
            const corrected = await processes.run([hook], options);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        },
    );
}
