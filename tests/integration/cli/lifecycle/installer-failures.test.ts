import { join, delimiter } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { installCommand } from '#cli/commands/install.ts';
import { installTools } from '#cli/tools/installation.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { installHooks } from '#cli/lifecycle/hooks/git.ts';
import { rejection } from '#tests/support/expectations.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { MISE_MIN_VERSION } from '#cli/config/tools/tools.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { rmSync, chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const { version: GSPOT_VERSION } = packageManifest;

test.each([
    { availability: 'missing', exitCode: 127, failureCommand: undefined, version: MISE_MIN_VERSION },
    { availability: 'outdated', exitCode: 0, failureCommand: undefined, version: '2020.1.1' },
    { availability: 'download-failed', exitCode: 1, failureCommand: 'install', version: MISE_MIN_VERSION },
])(
    'init preserves a usable configuration when mise is $availability and install reports the remaining work',
    async ({ availability, exitCode, failureCommand, version }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'README.md': 'Authored project.\n' });
        const run = processes.run;
        let isRepaired = false;
        const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
            if (command[0] !== 'mise') return run(command, options);
            const failed = !isRepaired && (failureCommand === undefined || command[1] === failureCommand);
            const code = failed ? exitCode : 0;
            return Promise.resolve({
                code,
                missing: code === 127,
                duration: 0,
                stdout: `mise ${isRepaired ? MISE_MIN_VERSION : version}`,
                stderr: '',
            });
        });
        try {
            const result = await initCommand({
                cwd: sandbox.path,
                yes: true,
                isDryRun: false,
                json: true,
                kits: ['none'],
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
            const session = await openSession(sandbox.path);
            expect(session.policyFiles.policy.kits).toStrictEqual([]);
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
            await rejection(
                initCommand({
                    cwd: sandbox.path,
                    yes: true,
                    isDryRun: false,
                    json: true,
                    kits: ['python'],
                    isListExact: true,
                    hooks: 'none',
                    ci: 'none',
                    runner: 'mise',
                    rules: 'no',
                    install: true,
                    allowDirty: true,
                }),
            ),
        ).toContain('Install uv');
        expect(readFileSync(join(sandbox.path, 'main.py'), 'utf8')).toBe('print("authored")\n');
        expect(existsSync(join(sandbox.path, '.gspot/uv.lock'))).toBe(false);
        expect(readFileSync(join(sandbox.path, 'pyrightconfig.json'), 'utf8')).toBe('{"exclude":["legacy"]}\n');
    } finally {
        installer.mockRestore();
    }
});

test.each([0, 1])('a hook conflict preserves independent installer execution and exit %s', async (code) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[hooks]\ntool = "gspot"\n[runner]\ntool = "mise"\n[guides]\ninstall = false\n'),
    });
    expect(processes.runBlocking(['git', 'init', '--quiet'], { cwd: sandbox.path }).code).toBe(0);
    const location = hookLocation(sandbox.path);
    writeFileSync(join(location.absolute, 'pre-push.gspot-original'), 'authored sibling');
    const read: string[][] = [];
    const run = processes.run;
    const installer = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'mise') return run(command, options);
        read.push([...command]);
        return Promise.resolve({
            code: command[1] === 'install' ? code : 0,
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
        expect(result.text.includes('installation command mise install failed')).toBe(code !== 0);
        expect(
            result.text.indexOf('Hook sibling already exists') <
                result.text.indexOf('installation command mise install failed'),
        ).toBe(code !== 0);
        expect(read).toContainEqual(['mise', 'install']);
        expect(readFileSync(join(location.absolute, 'pre-push.gspot-original'), 'utf8')).toBe('authored sibling');
        expect(existsSync(join(location.absolute, 'pre-commit'))).toBe(false);
    } finally {
        installer.mockRestore();
    }
});

// The hook is a POSIX shell script that a POSIX PATH runs directly.
if (onPosix) {
    test.each(['missing', 'not executable'])(
        'an installed hook reports setup failure when its gspot launcher is %s',
        async (condition) => {
            await using repository = await testdir();
            await createFileTree(repository.path, {
                'gspot.toml': policyOf([], '[hooks]\ntool = "gspot"\n[guides]\ninstall = false\n'),
                'bin/gspot': '#!/bin/sh\nexit 0\n',
            });
            const ran = await processes.run(['git', 'init', '-q'], { cwd: repository.path });
            expect(ran.code).toBe(0);
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
}

test('installation attributes a non-Error rejection to its phase', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf([], '[runner]\ntool = "mise"\n'),
    });
    const session = await openSession(sandbox.path);
    using installer = spyOn(processes, 'run').mockRejectedValue('untyped installer failure');
    expect(await rejection(installTools(session, true))).toBe('Native tool installation failed.');
    expect(installer.mock.calls.map(([command]) => command)).toStrictEqual([['mise', '--version']]);
});
