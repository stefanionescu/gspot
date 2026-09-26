import { delimiter, join } from 'node:path';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { MISE_MIN_VERSION } from '#cli/tools/mise.ts';
import { openSession } from '#cli/execution/session.ts';
import { installCommand } from '#cli/commands/install.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { hookLocation, installHooks } from '#cli/lifecycle/hooks/git.ts';
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };
import { rejection } from '#tests/support/rejection.ts';

const { version: GSPOT_VERSION } = packageManifest;

test.each(['missing', 'outdated', 'download-failed'] as const)(
    'init preserves a usable configuration when mise is %s and install reports the remaining work',
    async (availability) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': 'Authored project.\n' });
        const run = processes.run;
        let isRepaired = false;
        const installer = spyOn(processes, 'run').mockImplementation((command, options) =>
            command[0] === 'mise'
                ? Promise.resolve({
                      code:
                          !isRepaired && availability === 'missing'
                              ? 127
                              : !isRepaired && availability === 'download-failed' && command[1] === 'install'
                                ? 1
                                : 0,
                      missing: !isRepaired && availability === 'missing',
                      duration: 0,
                      stdout: !isRepaired && availability === 'outdated' ? 'mise 2020.1.1' : `mise ${MISE_MIN_VERSION}`,
                      stderr: '',
                  })
                : run(command, options),
        );
        try {
            const result = await initCommand({
                cwd: sandbox.path,
                yes: true,
                isDryRun: false,
                json: true,
                configurations: ['none'],
                hooks: 'none',
                ci: 'none',
                runner: 'mise',
                rules: 'no',
                install: true,
                allowDirty: true,
            });
            expect(result.exitCode).toBe(2);
            expect(result.text).toContain('tool installation is incomplete');
            expect(result.text).toContain('Run: gspot install');
            expect((await openSession(sandbox.path)).policyFiles.policy.configurations).toStrictEqual([]);
            expect(readFileSync(join(sandbox.path, 'README.md'), 'utf8')).toBe('Authored project.\n');
            const retry = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(retry.exitCode).toBe(2);
            expect(retry.text).toContain(
                availability === 'download-failed' ? 'installation command mise install failed' : 'Install mise',
            );
            const policy = readFileSync(join(sandbox.path, 'gspot.toml'));
            isRepaired = true;
            const repaired = await installCommand({ cwd: sandbox.path, isDryRun: false });
            expect(repaired.exitCode, repaired.text).toBe(0);
            expect(readFileSync(join(sandbox.path, 'gspot.toml'))).toStrictEqual(policy);
            expect(readFileSync(join(sandbox.path, '.gspot/version'), 'utf8').trim()).toBe(GSPOT_VERSION);
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
    const installer = spyOn(processes, 'run').mockImplementation((command, options) =>
        command[0] === 'uv'
            ? Promise.resolve({ code: 127, missing: true, duration: 0, stdout: '', stderr: '' })
            : run(command, options),
    );
    try {
        expect(
            (
                await rejection(
                    initCommand({
                        cwd: sandbox.path,
                        yes: true,
                        isDryRun: false,
                        json: true,
                        configurations: ['python'],
                        isListExact: true,
                        hooks: 'none',
                        ci: 'none',
                        runner: 'mise',
                        rules: 'no',
                        install: true,
                        allowDirty: true,
                    }),
                )
            ).message,
        ).toContain('Install uv');
        expect(readFileSync(join(sandbox.path, 'main.py'), 'utf8')).toBe('print("authored")\n');
        expect(existsSync(join(sandbox.path, '.gspot/uv.lock'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'pyrightconfig.json'), 'utf8')).toBe('{"exclude":["legacy"]}\n');
    } finally {
        installer.mockRestore();
    }
});

test('a hook conflict reports inability while independent installer steps still run', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[runner]\ntool = "mise"\n[rules]\ninstall = false\n',
    });
    expect(processes.runBlocking(['git', 'init', '--quiet'], { cwd: sandbox.path }).code).toBe(0);
    const location = hookLocation(sandbox.path);
    writeFileSync(join(location.absolute, 'pre-push.gspot-original'), 'authored sibling');
    const observed: string[][] = [];
    const run = processes.run;
    const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'mise') return run(command, options);
        observed.push([...command]);
        return Promise.resolve({
            code: 0,
            missing: false,
            duration: 0,
            stdout: `mise ${MISE_MIN_VERSION}`,
            stderr: '',
        });
    });
    try {
        const result = await installCommand({ cwd: sandbox.path, isDryRun: false });
        expect(result.exitCode).toBe(2);
        expect(result.text).toContain('Hook sibling already exists');
        expect(observed).toContainEqual(['mise', 'install']);
        expect(readFileSync(join(location.absolute, 'pre-push.gspot-original'), 'utf8')).toBe('authored sibling');
        expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
    } finally {
        installer.mockRestore();
    }
});

test.each(['missing', 'not executable'])(
    'an installed hook reports setup failure when its gspot launcher is %s',
    async (condition) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': 'version = 1\nconfigurations = []\n[hooks]\ntool = "gspot"\n[rules]\ninstall = false\n',
            'bin/gspot': '#!/bin/sh\nexit 0\n',
        });
        expect((await processes.run(['git', 'init', '-q'], { cwd: repository.path })).code).toBe(0);
        installHooks(
            await openSession(repository.path).then((session) => ({
                policy: session.policyFiles.policy,
                repository: session.repository,
            })),
        );
        const launcher = join(repository.path, 'bin/gspot');
        if (condition === 'missing') rmSync(launcher);
        else chmodSync(launcher, 0o644);
        const hook = join(hookLocation(repository.path).absolute, 'pre-commit');
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
