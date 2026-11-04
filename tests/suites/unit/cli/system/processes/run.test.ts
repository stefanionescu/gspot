import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { join, delimiter } from 'node:path';
import { runProcess } from '#cli/system/processes.ts';
import { listExecutableNames } from '#cli/system/paths.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a program runs its sibling commands before unrelated PATH tools', async () => {
    await using sandbox = await testdir();
    await writeProgramCommand(sandbox.path, 'selected/parent', 'processes/command', 'sibling');
    await writeProgramCommand(sandbox.path, 'selected/sibling', 'fakes/tool', '--line', 'selected');
    await writeProgramCommand(sandbox.path, 'unrelated/sibling', 'fakes/tool', '--line', 'unrelated');
    const result = await runProcess([join(sandbox.path, 'selected', listExecutableNames('parent')[0] as string)], {
        cwd: sandbox.path,
        env: { PATH: join(sandbox.path, 'unrelated') },
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('selected');
});

test('Git runs from outside the repository of the folder', async () => {
    await using sandbox = await createGitSandbox({});
    await writeProgramCommand(sandbox.path, 'bin/git', 'fakes/tool', '--line', 'committed git');
    const previous = process.cwd();
    process.chdir(sandbox.path);
    try {
        const env = { PATH: `${join(sandbox.path, 'bin')}${delimiter}${readEnvironmentVariable('PATH') ?? ''}` };
        const result = await runProcess(['git', '--version'], { cwd: sandbox.path, env });
        expect(result.stdout).toStartWith('git version');
    } finally {
        process.chdir(previous);
    }
});

test('a program with no copy outside the repository is missing', async () => {
    await using sandbox = await createGitSandbox({});
    await writeProgramCommand(sandbox.path, 'bin/mise', 'fakes/tool', '--line', 'committed mise');
    const previous = process.cwd();
    process.chdir(sandbox.path);
    try {
        const result = await runProcess(['mise', '--version'], {
            cwd: sandbox.path,
            env: { PATH: join(sandbox.path, 'bin') },
        });
        expect(result.end).toBe('missing');
    } finally {
        process.chdir(previous);
    }
});

test('reads both large output streams to the end and keeps exit code 1', async () => {
    const status = 1;
    await using sandbox = await testdir();
    const command = buildProgramCommand(
        'processes/output',
        '--text',
        'é',
        '--count',
        String(1024 * 1024),
        '--exit',
        String(status),
    );
    const result = await runProcess(command, {
        cwd: sandbox.path,
    });
    expect(result.code).toBe(status);
    expect(result.stdout).toBe('é'.repeat(1024 * 1024));
    expect(result.stderr).toBe(result.stdout);
    expect(result.end).toBe('exited');
});

test('a missing program is a launch failure with its error output', async () => {
    await using sandbox = await testdir();
    const result = await runProcess([join(sandbox.path, 'missing-executable')], { cwd: sandbox.path });
    expect(result.code).toBe(127);
    expect(result.end).toBe('missing');
    expect(result.stderr).toContain(join(sandbox.path, 'missing-executable'));
});

test.skipIf(isWindows)('a program without permission to run is not a missing program', async () => {
    await using sandbox = await testdir({ 'denied.sh': '#!/bin/sh\nexit 0\n' });

    const executable = join(sandbox.path, 'denied.sh');
    await chmod(executable, 0o600);
    const result = await runProcess([executable], { cwd: sandbox.path });
    expect(result.code).not.toBe(0);
    expect(result.code).not.toBe(127);
    expect(result.end).toBe('failed');
    expect(result.stderr.split('\n', 1)[0]).toBe(`Command failed with EACCES: ${executable}`);
});

test.skipIf(isWindows)('a program that the system cannot execute fails without stopping gspot', async () => {
    await using sandbox = await testdir({ 'empty-program': '' });

    const executable = join(sandbox.path, 'empty-program');
    await chmod(executable, 0o755);
    const result = await runProcess([executable], { cwd: sandbox.path });
    expect(result.code).not.toBe(0);
    expect(result.end).toBe('failed');
});

test('a timeout stops the process and reports it', async () => {
    await using sandbox = await testdir();
    const result = await runProcess(buildProgramCommand('fakes/tool', '--wait'), {
        cwd: sandbox.path,
        timeoutSeconds: 0.15,
    });
    expect(result.end).toBe('timed-out');
    expect(result.code).not.toBe(0);
});

test.skipIf(isWindows)('a signal before the timeout is not a timeout', async () => {
    await using sandbox = await testdir();
    const result = await runProcess(buildProgramCommand('fakes/tool', '--signal', 'SIGTERM'), {
        cwd: sandbox.path,
    });
    expect(result.end).toBe('failed');
    expect(result.code).not.toBe(0);
});

test('a process canceled before it starts reports the cancellation', async () => {
    await using sandbox = await testdir();
    const controller = new AbortController();
    controller.abort(new Error('Native cancellation'));
    const result = await runProcess(buildProgramCommand('fakes/tool'), {
        cwd: sandbox.path,
        cancelSignal: controller.signal,
    });
    expect(result.end).toBe('canceled');
    expect(result.code).not.toBe(0);
});

test('keeps stdin, argument boundaries, final newlines, and the environment', async () => {
    await using sandbox = await testdir();
    const input = 'line one\nline two\n';

    const result = await runProcess(
        buildProgramCommand(
            'fakes/tool',
            '--record',
            '-',
            '--environment',
            'GSPOT_PROCESS_CASE',
            '--stdin',
            '--',
            'space separated',
            '$(echo must-stay-literal)',
        ),
        {
            cwd: sandbox.path,
            env: { GSPOT_PROCESS_CASE: 'selected' },
            stdin: input,
        },
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({
        arguments: ['space separated', '$(echo must-stay-literal)'],
        environment: { GSPOT_PROCESS_CASE: 'selected' },
        cwd: sandbox.path,
        stdin: input,
    });
    expect(result.stdout).toEndWith('\n');
});

test.skipIf(isWindows)('an environment variable set to undefined is removed', async () => {
    await using sandbox = await testdir();

    const result = await runProcess(buildProgramCommand('fakes/tool', '--record', '-', '--environment', 'PATH'), {
        cwd: sandbox.path,
        env: { PATH: undefined },
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ environment: { PATH: null } });
});

test('sets PWD to the child working folder', async () => {
    await using sandbox = await testdir();
    const result = await runProcess(buildProgramCommand('fakes/tool', '--record', '-', '--environment', 'PWD'), {
        cwd: sandbox.path,
        env: { PWD: '/different/symlink/path' },
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ environment: { PWD: sandbox.path } });
});
