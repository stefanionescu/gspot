import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { chmodSync, copyFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';

test('source launcher preserves directory, arguments, input, and exit status', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        '.mise/gspot/gspot': '',
        'caller/input': '',
        'packages/cli/src/main.ts': `
            const input = await new Response(Bun.stdin.stream()).text();
            console.log(JSON.stringify({cwd: process.cwd(), args: process.argv.slice(2), input}));
            process.exitCode = 7;
        `,
    });
    const launcher = join(sandbox.path, '.mise/gspot/gspot');
    copyFileSync(fileURLToPath(new URL('../../../.mise/gspot/gspot', import.meta.url)), launcher);
    chmodSync(launcher, 0o755);
    const args = ["author's file", 'two words', '$(false); *', 'line\nbreak', ''];
    const child = Bun.spawn([launcher, ...args], {
        cwd: join(sandbox.path, 'caller'),
        stdin: new Blob(['exact input\n']),
        stdout: 'pipe',
        stderr: 'pipe',
    });
    const output = new Response(child.stdout).text();
    expect(await child.exited, await new Response(child.stderr).text()).toBe(7);
    expect(JSON.parse(await output)).toStrictEqual({ cwd: join(sandbox.path, 'caller'), args, input: 'exact input\n' });
});

test.each(['SIGINT', 'SIGTERM'] as const)(
    'source launcher delivers %s directly to the source process',
    async (signal) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            '.mise/gspot/gspot': '',
            'packages/cli/src/main.ts': `process.once('${signal}', () => process.exit(23)); console.log('ready'); setInterval(() => {}, 1000);`,
        });
        const launcher = join(sandbox.path, '.mise/gspot/gspot');
        copyFileSync(fileURLToPath(new URL('../../../.mise/gspot/gspot', import.meta.url)), launcher);
        chmodSync(launcher, 0o755);
        const child = Bun.spawn([launcher], { stdout: 'pipe', stderr: 'pipe' });
        try {
            const reader = child.stdout.getReader();
            const ready = await reader.read();
            expect(new TextDecoder().decode(ready.value)).toBe('ready\n');
            reader.releaseLock();
            child.kill(signal);
            expect(await child.exited, await new Response(child.stderr).text()).toBe(23);
        } finally {
            if (child.exitCode === null) child.kill('SIGKILL');
            await child.exited;
        }
    },
);
