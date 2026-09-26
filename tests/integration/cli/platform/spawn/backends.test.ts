// Exercise the shared process contract through real child processes.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run, runBlocking } from '#cli/platform/spawn.ts';

const backends = [
    { name: 'asynchronous', execute: run },
    { name: 'synchronous', execute: runBlocking },
];

for (const backend of backends) {
    describe(backend.name, () => {
        test('a selected executable resolves its sibling commands before unrelated PATH tools', async () => {
            await using sandbox = await testdir();
            const extension = process.platform === 'win32' ? '.cmd' : '';
            const script = (command: string) =>
                process.platform === 'win32' ? `@echo off\r\n${command}\r\n` : `#!/bin/sh\n${command}\n`;
            await createFileTree(sandbox.path, {
                [`selected/parent${extension}`]: script('sibling'),
                [`selected/sibling${extension}`]: script('echo selected'),
                [`unrelated/sibling${extension}`]: script('echo unrelated'),
            });
            for (const path of ['selected/parent', 'selected/sibling', 'unrelated/sibling'])
                chmodSync(join(sandbox.path, path + extension), 0o755);
            const result = await backend.execute([join(sandbox.path, `selected/parent${extension}`)], {
                cwd: sandbox.path,
                env: { PATH: join(sandbox.path, 'unrelated') },
            });
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout.trim()).toBe('selected');
        });
        test.each([0, 1])('drains both large streams and preserves status %s', async (status) => {
            await using sandbox = await testdir();
            const script = `const text = 'é'.repeat(1024 * 1024);
process.stdout.write(text);
process.stderr.write(text);
process.exitCode = ${String(status)};`;
            const result = await backend.execute([process.execPath, '-e', script], {
                cwd: sandbox.path,
                timeoutMs: 5000,
            });
            expect(result.code).toBe(status);
            expect(result.stdout).toBe('é'.repeat(1024 * 1024));
            expect(result.stderr).toBe(result.stdout);
            expect(result.isTimedOut).toBe(false);
            expect(result.missing).toBe(false);
        });

        test('missing executable is a launch failure with diagnostics', async () => {
            await using sandbox = await testdir();
            const result = await backend.execute([join(sandbox.path, 'missing-executable')], { cwd: sandbox.path });
            expect(result.code).toBe(127);
            expect(result.missing).toBe(true);
            expect(result.stderr).not.toBe('');
        });

        if (process.platform !== 'win32')
            test('denied execution is distinct from a missing file', async () => {
                await using sandbox = await testdir();
                await createFileTree(sandbox.path, { 'denied.sh': '#!/bin/sh\nexit 0\n' });
                const executable = join(sandbox.path, 'denied.sh');
                chmodSync(executable, 0o600);
                const result = await backend.execute([executable], { cwd: sandbox.path });
                expect(result.code).not.toBe(0);
                expect(result.code).not.toBe(127);
                expect(result.missing).toBe(false);
                expect(result.stderr).not.toBe('');
            });

        test('a genuine deadline terminates the process and reports timeout', async () => {
            await using sandbox = await testdir();
            const result = await backend.execute([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
                cwd: sandbox.path,
                timeoutMs: 150,
            });
            expect(result.isTimedOut).toBe(true);
            expect(result.code).not.toBe(0);
            expect(result.duration).toBeLessThan(3000);
        });

        test('a signal before the deadline is not a timeout', async () => {
            await using sandbox = await testdir();
            const result = await backend.execute([process.execPath, '-e', "process.kill(process.pid, 'SIGTERM')"], {
                cwd: sandbox.path,
                timeoutMs: 5000,
            });
            expect(result.isTimedOut).toBe(false);
            expect(result.isErrored).toBe(true);
            expect(result.code).not.toBe(0);
            expect(result.missing).toBe(false);
        });
    });
}

test('cancellation terminates the process without reporting a timeout', async () => {
    await using sandbox = await testdir();
    const result = await run([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
        cwd: sandbox.path,
        timeoutMs: 5000,
        cancelSignal: AbortSignal.timeout(150),
    });
    expect(result.isCanceled).toBe(true);
    expect(result.isTimedOut).toBe(false);
    expect(result.code).not.toBe(0);
    expect(result.duration).toBeLessThan(3000);
});

test('preserves stdin, argument boundaries, final newlines, and the requested environment', async () => {
    await using sandbox = await testdir();
    const input = 'line one\nline two\n';
    for (const backend of backends) {
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
        expect(result.stdout.endsWith('\n')).toBe(true);
    }
});

test('explicitly removes inherited environment values', async () => {
    await using sandbox = await testdir();
    for (const backend of backends) {
        const result = await backend.execute(
            [process.execPath, '-e', 'process.stdout.write(String(process.env.PATH === undefined))'],
            {
                cwd: sandbox.path,
                env: { PATH: undefined },
            },
        );
        expect(result.code).toBe(0);
        expect(result.stdout).toBe('true');
    }
});
