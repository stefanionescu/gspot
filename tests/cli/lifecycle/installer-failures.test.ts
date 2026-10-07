import { join, delimiter } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { CLI_PINS } from '#cli/config/configurations.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { installCommand } from '#cli/commands/install.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { rejection, textContaining } from '#tests/harness/expectations.ts';
import { AUTOMATIC_GENERAL_CONFIGURATIONS } from '#tests/config/harness/policy.ts';
import { rmSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
                    hooks: false,
                    ci: 'none',
                    runner: 'mise',
                    rules: false,
                    install: true,
                }),
            );
            expect(result.exitCode).toBe(2);
            expect(result.json).toMatchObject({ error: 'installation', message: textContaining('Run: gspot install') });
            expect(result.text).toContain('Tool installation is incomplete');
            expect(result.text).toContain('Run: gspot install');
            expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8').trim()).toBe(RUNNING_VERSION);
            const session = await openSession(sandbox.path);
            expect(session.policyFiles.policy.configurations).toStrictEqual(AUTOMATIC_GENERAL_CONFIGURATIONS);
            expect(readFileSync(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
            const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(retry.exitCode).toBe(2);
            expect(retry.text).toContain(retryDiagnostic);
            const policy = readFileSync(join(sandbox.path, 'gspot.toml'));
            isRepaired = true;
            const repaired = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(repaired.exitCode, repaired.text).toBe(0);
            expect(readFileSync(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
        } finally {
            installer.mockRestore();
        }
    },
);

test('init does not report success when required Python lock resolution cannot run', async () => {
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
                        hooks: false,
                        ci: 'none',
                        runner: 'mise',
                        rules: false,
                        install: true,
                    }),
                ),
            ),
        ).toContain('uv is unavailable. Run: python -m pip install uv==');
        expect(readFileSync(join(sandbox.path, 'main.py'), 'utf8')).toBe('print("authored")\n');
        expect(existsSync(join(sandbox.path, '.gspot/uv.lock'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'pyrightconfig.json'), 'utf8')).toBe('{"exclude":["legacy"]}\n');
    } finally {
        installer.mockRestore();
    }
});

test('a repository that already runs hooks keeps them, gets the gspot lines, and the other installers still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: 'run_with = "mise"\n[hooks]\n[agent_rules]\nenabled = false\n' }),
        '.githooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    expect(processes.runBlocking(['git', 'init', '--quiet'], { cwd: sandbox.path }).code).toBe(0);
    expect(processes.runBlocking(['git', 'config', 'core.hooksPath', '.githooks'], { cwd: sandbox.path }).code).toBe(0);
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
        expect(processes.runBlocking(['git', 'config', 'core.hooksPath'], { cwd: sandbox.path }).stdout.trim()).toBe(
            '.githooks',
        );
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
                'gspot.toml': buildPolicy([], { tables: '[hooks]\n[agent_rules]\nenabled = false\n' }),
                'bin/gspot': '#!/bin/sh\nexit 0\n',
            });
            const ran = await processes.run(['git', 'init', '-q'], { cwd: repository.path });
            expect(ran.code).toBe(0);
            {
                using log = openOwnership(repository.path);
                writeOutputs(await openSession(repository.path), log);
            }
            const launcher = join(repository.path, 'bin/gspot');
            if (condition === 'missing') rmSync(launcher);
            else chmodSync(launcher, 0o644);
            const hook = join(repository.path, '.gspot/hooks/pre-commit');
            const options = {
                cwd: repository.path,
                env: { PATH: `${join(repository.path, 'bin')}${delimiter}/usr/bin${delimiter}/bin` },
            };
            const failed = await processes.run([hook], options);
            expect(failed.code, failed.stdout + failed.stderr).toBe(2);
            expect(failed.stderr).toContain('gspot install');
            writeFileSync(launcher, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
            chmodSync(launcher, 0o755);
            const corrected = await processes.run([hook], options);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        },
    );
}
