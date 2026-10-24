import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { listExecutableNames } from '#cli/system/paths.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import type { ProcessBackend } from '#tests/types/processes.ts';
import { writeScriptCommand } from '#tests/setup/system/fakes.ts';
import { limitToTestDeadline } from '#tests/setup/system/processes.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { spawnProcess, spawnProcessBlocking } from '#cli/system/processes.ts';

test.each(buildProcessBackends())(
    '$name: a chosen program runs its sibling commands before unrelated PATH tools',
    async (backend) => {
        await using sandbox = await testdir();
        await writeScriptCommand(
            sandbox.path,
            'selected/parent',
            "const child = Bun.spawnSync(['sibling'], { stdout: 'inherit', stderr: 'inherit' }); process.exitCode = child.exitCode;",
        );
        await writeScriptCommand(sandbox.path, 'selected/sibling', "console.log('selected');");
        await writeScriptCommand(sandbox.path, 'unrelated/sibling', "console.log('unrelated');");
        const result = await backend.execute(
            [join(sandbox.path, 'selected', listExecutableNames('parent')[0] as string)],
            {
                cwd: sandbox.path,
                env: { PATH: join(sandbox.path, 'unrelated') },
            },
        );
        expect(result.code, result.stderr).toBe(0);
        expect(result.stdout.trim()).toBe('selected');
    },
);

test.each(buildProcessBackends().flatMap((backend) => [0, 1].map((status) => ({ backend, status }))))(
    '$backend.name: reads both large output streams to the end and keeps exit code $status',
    async ({ backend, status }) => {
        await using sandbox = await testdir();
        const script = `const text = 'é'.repeat(1024 * 1024);
process.stdout.write(text);
process.stderr.write(text);
process.exitCode = ${String(status)};`;
        const result = await backend.execute([process.execPath, '-e', script], {
            cwd: sandbox.path,
        });
        expect(result.code).toBe(status);
        expect(result.stdout).toBe('é'.repeat(1024 * 1024));
        expect(result.stderr).toBe(result.stdout);
        expect(result.timedOut).toBe(false);
        expect(result.missing).toBe(false);
    },
);

test.each(buildProcessBackends())(
    '$name: a missing program is a launch failure with its error output',
    async (backend) => {
        await using sandbox = await testdir();
        const result = await backend.execute([join(sandbox.path, 'missing-executable')], { cwd: sandbox.path });
        expect(result.code).toBe(127);
        expect(result.missing).toBe(true);
        expect(result.stderr).not.toBe('');
    },
);

test.skipIf(isWindows).each(buildProcessBackends())(
    '$name: a program without permission to run is not a missing program',
    async (backend) => {
        await using sandbox = await testdir({ 'denied.sh': '#!/bin/sh\nexit 0\n' });

        const executable = join(sandbox.path, 'denied.sh');
        await chmod(executable, 0o600);
        const result = await backend.execute([executable], { cwd: sandbox.path });
        expect(result.code).not.toBe(0);
        expect(result.code).not.toBe(127);
        expect(result.missing).toBe(false);
        expect(result.stderr).not.toBe('');
    },
);

test.each(buildProcessBackends())('$name: a timeout stops the process and reports it', async (backend) => {
    await using sandbox = await testdir();
    const result = await backend.execute([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
        cwd: sandbox.path,
        timeoutSeconds: 0.15,
    });
    expect(result.timedOut).toBe(true);
    expect(result.code).not.toBe(0);
});

test.skipIf(isWindows).each(buildProcessBackends())(
    '$name: a signal before the timeout is not a timeout',
    async (backend) => {
        await using sandbox = await testdir();
        const result = await backend.execute([process.execPath, '-e', "process.kill(process.pid, 'SIGTERM')"], {
            cwd: sandbox.path,
        });
        expect(result.timedOut).toBe(false);
        expect(result.errored).toBe(true);
        expect(result.code).not.toBe(0);
        expect(result.missing).toBe(false);
    },
);

test('a process canceled before it starts reports the cancellation', async () => {
    await using sandbox = await testdir();
    const controller = new AbortController();
    controller.abort(new Error('Native cancellation'));
    const result = await spawnProcess([process.execPath, '-e', 'process.exit(0)'], {
        cwd: sandbox.path,
        cancelSignal: controller.signal,
    });
    expect(result.canceled).toBe(true);
    expect(result.code).not.toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.missing).toBe(false);
});

test.each(buildProcessBackends())(
    '$name: keeps stdin, argument boundaries, final newlines, and the given environment',
    async (backend) => {
        await using sandbox = await testdir();
        const input = 'line one\nline two\n';

        const result = await backend.execute(
            [
                process.execPath,
                '-e',
                String.raw`
            const text = await new Response(Bun.stdin.stream()).text();
            process.stdout.write(JSON.stringify({ text, args: process.argv.slice(1), value: process.env.GSPOT_PROCESS_CASE, cwd: process.cwd() }) + '\n');
        `,
                'space separated',
                '$(echo must-stay-literal)',
            ],
            {
                cwd: sandbox.path,
                env: { GSPOT_PROCESS_CASE: 'selected' },
                stdin: input,
            },
        );
        expect(result.code).toBe(0);
        expect(JSON.parse(result.stdout)).toStrictEqual({
            text: input,
            args: ['space separated', '$(echo must-stay-literal)'],
            value: 'selected',
            cwd: sandbox.path,
        });
        expect(result.stdout).toEndWith('\n');
    },
);

test.skipIf(isWindows).each(buildProcessBackends())(
    '$name: an environment variable set to undefined is removed',
    async (backend) => {
        await using sandbox = await testdir();

        const result = await backend.execute(
            [process.execPath, '-e', 'process.stdout.write(String(process.env.PATH === undefined))'],
            {
                cwd: sandbox.path,
                env: { PATH: undefined },
            },
        );
        expect(result.code).toBe(0);
        expect(result.stdout).toBe('true');
    },
);

function buildProcessBackends(): ProcessBackend[] {
    return [
        {
            name: 'asynchronous',
            execute: async (command: string[], options: AsyncSpawnOptions) =>
                await spawnProcess(command, limitToTestDeadline(command, options).options),
        },
        {
            name: 'synchronous',
            execute: (command: string[], options: AsyncSpawnOptions) =>
                spawnProcessBlocking(command, limitToTestDeadline(command, options).options),
        },
    ];
}

test.each(buildProcessBackends())('$name: sets PWD to the child working folder', async (backend) => {
    await using sandbox = await testdir();
    const result = await backend.execute([process.execPath, '-e', 'process.stdout.write(process.env.PWD)'], {
        cwd: sandbox.path,
        env: { PWD: '/different/symlink/path' },
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(sandbox.path);
});
