import { join } from 'node:path';
import { testdir } from 'testdirs';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { run } from '#cli/system/processes.ts';
import { test, spyOn, expect } from 'bun:test';
import * as childProcess from 'node:child_process';
import { CLI_SOURCE } from '#tests/setup/run-gspot.ts';
import type { AsyncSpawnOptions } from '#cli/types/system/processes.ts';
import { waitForExit, prepareCommand } from '#tests/setup/processes.ts';
import { isWindows, useOperatingSystem } from '#tests/setup/operating-systems.ts';

const captures = {
    text: (command: string[], options: AsyncSpawnOptions) => run(command, prepareCommand(command, options).options),
    bytes: async (command: string[], options: AsyncSpawnOptions) => {
        const chunks: Buffer[] = [];
        const result = await run(command, { ...prepareCommand(command, options).options }, async (output) => {
            for await (const chunk of output) chunks.push(chunk);
        });
        return { ...result, stdout: Buffer.concat(chunks) };
    },
};

// What the supervisor leaves on a child it stopped: a signal on a POSIX host, an exit code on Windows.
function terminated(child: childProcess.ChildProcess | undefined): boolean {
    if (child === undefined) return false;
    if (isWindows) return child.exitCode !== null;
    return child.signalCode !== null;
}

test.each(['text', 'bytes'] as const)('a failed %s stream read stops the child', async (capture) => {
    await using sandbox = await testdir();
    using children = spyOn(childProcess, 'spawn');
    let child: childProcess.ChildProcess | undefined;
    try {
        const running = captures[capture]([process.execPath, '-e', 'setInterval(() => {}, 1000)'], {
            cwd: sandbox.path,
        });
        const launched = children.mock.results[0];
        if (launched?.type === 'return') {
            child = launched.value;
            child.stdout?.emit('error', new Error('Test stream failure.'));
        }
        if (capture === 'bytes') {
            expect(running).rejects.toThrow('Test stream failure');
            expect(terminated(child)).toBe(true);
            return;
        }
        const result = await running;
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        expect(result.code).not.toBe(0);
        expect(result.missing).toBe(false);
        expect(result.stderr).toContain('Test stream failure');
        expect(terminated(child)).toBe(true);
    } finally {
        if (child?.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
});

test('byte capture keeps invalid UTF-8 bytes and the error output', async () => {
    await using sandbox = await testdir();
    const result = await captures.bytes(
        [
            process.execPath,
            '-e',
            String.raw`process.stdout.write(Buffer.from([0, 255, 128, 10])); process.stderr.write("diagnostic\n");`,
        ],
        { cwd: sandbox.path },
    );
    expect([...result.stdout]).toStrictEqual([0, 255, 128, 10]);
    expect(result.stderr).toBe('diagnostic\n');
    expect(result.code).toBe(0);
});

test.each([
    ['text', 'timeout'],
    ['bytes', 'canceled'],
] as const)(
    '%s capture stops child processes on %s before they write after the time limit',
    async (capture, termination) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'descendant-survived');
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log("descendant-ready"); setInterval(() => {}, 1000);`;
        const parent = `Bun.spawn([process.execPath, "-e", ${JSON.stringify(descendant)}], {stdout:"inherit", stderr:"inherit"}); await Bun.sleep(10000);`;
        const running = captures[capture]([process.execPath, '-e', parent], {
            cwd: sandbox.path,
            ...(termination === 'timeout' ? { timeoutMs: 1500 } : {}),
            ...(termination === 'canceled' ? { cancelSignal: AbortSignal.timeout(1500) } : {}),
        });
        if (capture === 'bytes') expect(running).rejects.toThrow('The operation timed out');
        else {
            const result = await running;
            expect(Buffer.from(result.stdout).toString('utf8')).toContain('descendant-ready');
            expect(result.isTimedOut).toBe(termination === 'timeout');
            expect(result.isCanceled).toBe(termination === 'canceled');
        }
        const pid = Number(await readFile(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

test('an exiting CLI stops its running process group', async () => {
    await using sandbox = await testdir();
    const descendant = 'console.log(process.pid); setInterval(() => {}, 1000);';
    const sourceUrl = pathToFileURL(join(CLI_SOURCE, 'system/processes.ts')).href;
    const script = `import {run} from ${JSON.stringify(sourceUrl)}; void run([process.execPath,"-e",${JSON.stringify(descendant)}],{cwd:process.cwd(),onStdout(chunk){process.stdout.write(chunk);process.exit(19);}});`;
    const command = [process.execPath, '-e', script];
    const prepared = prepareCommand(command, { cwd: sandbox.path });
    const child = Bun.spawn(command, {
        cwd: sandbox.path,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
        killSignal: 'SIGKILL',
    });
    const output = new Response(child.stdout).text();
    const errors = new Response(child.stderr).text();
    try {
        expect(await child.exited, await errors).toBe(19);
        const printed = await output;
        const pid = Number(printed.trim());
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    } finally {
        if (child.exitCode === null) child.kill('SIGKILL');
        await child.exited;
        await output;
        await errors;
    }
});

test('live output arrives before the process ends while capture keeps the output and exit code', async () => {
    await using sandbox = await testdir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const ready = Promise.withResolvers<undefined>();
    const release = join(sandbox.path, 'release');
    const child = `console.log('ready'); console.error('diagnostic'); while (!(await Bun.file(${JSON.stringify(release)}).exists())) await Bun.sleep(10); process.exitCode = 7;`;
    let completed = false;
    const running = captures
        .text([process.execPath, '-e', child], {
            cwd: sandbox.path,
            onStdout: (chunk) => {
                stdout.push(chunk);
                ready.resolve();
            },
            onStderr: (chunk) => {
                stderr.push(chunk);
            },
        })
        .then((result) => {
            completed = true;
            return result;
        });
    try {
        await Promise.race([
            ready.promise,
            running.then(() => {
                throw new Error('No live output.');
            }),
        ]);
        expect(completed).toBe(false);
        expect(stdout.join('')).toContain('ready');
    } finally {
        await Bun.write(release, 'continue');
    }
    const result = await running;
    expect(result.code).toBe(7);
    expect(result.stdout).toBe(stdout.join(''));
    expect(result.stderr).toBe(stderr.join(''));
    expect(result.stderr).toContain('diagnostic');
});

test.each(['text', 'bytes'] as const)(
    '%s capture stops child processes that hold the output after the parent exits',
    async (capture) => {
        await using sandbox = await testdir();
        const marker = join(sandbox.path, 'orphan-survived');
        const descendant = `await Bun.write(${JSON.stringify(marker)}, String(process.pid)); console.log('ready'); setInterval(() => {}, 1000);`;
        const parent = `const child = Bun.spawn([process.execPath, '-e', ${JSON.stringify(descendant)}], {stdout:'pipe', stderr:'inherit'}); for await (const chunk of child.stdout) { process.stdout.write(chunk); process.exit(7); }`;
        const result = await captures[capture]([process.execPath, '-e', parent], {
            cwd: sandbox.path,
        });
        expect(result.code).toBe(7);
        expect(Buffer.from(result.stdout).toString('utf8')).toContain('ready');
        expect(result.isTimedOut).toBe(false);
        expect(result.isCanceled).toBe(false);
        const pid = Number(await readFile(marker, 'utf8'));
        expect(pid).toBeGreaterThan(0);
        await waitForExit(pid);
    },
);

test('the stop after a normal exit accepts the macOS refusal to signal an exited group', async () => {
    using resources = new DisposableStack();

    await using sandbox = await testdir();
    const signal = process.kill.bind(process);
    // macOS refuses to signal a group after its members exit, before their parent collects them.
    resources.use(
        spyOn(process, 'kill').mockImplementation((pid, kind) => {
            if (pid < 0) throw Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
            return signal(pid, kind);
        }),
    );
    using _operatingSystem = useOperatingSystem('darwin');

    const result = await captures.text([process.execPath, '-e', 'process.exit(0)'], {
        cwd: sandbox.path,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(result.isErrored).toBe(false);
});

test('stream reading keeps raw bytes and the error output', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        String.raw`process.stdout.write(Buffer.from([0,255,0,10])); process.stderr.write("diagnostic\n");`,
    ];
    const bytes: Buffer[] = [];
    const result = await run(command, { ...prepareCommand(command, { cwd: sandbox.path }).options }, async (chunks) => {
        for await (const chunk of chunks) bytes.push(chunk);
    });
    expect(Buffer.concat(bytes)).toStrictEqual(Buffer.from([0, 255, 0, 10]));
    expect(result).toMatchObject({ code: 0, stdout: '', stderr: 'diagnostic\n', missing: false });
});

test('a stream reader that throws stops and drains its child', async () => {
    await using sandbox = await testdir();
    using children = spyOn(childProcess, 'spawn');
    const failure = new Error('Consumer refused the bytes.');
    const command = [process.execPath, '-e', 'process.stdout.write("ready"); setInterval(() => {}, 1000);'];
    expect(
        run(command, { ...prepareCommand(command, { cwd: sandbox.path }).options }, async (chunks) => {
            for await (const chunk of chunks) {
                expect(chunk.length).toBeGreaterThan(0);
                throw failure;
            }
        }),
    ).rejects.toBe(failure);
    const launched = children.mock.results[0];
    expect(launched?.type).toBe('return');
    if (launched?.type === 'return') expect(terminated(launched.value)).toBe(true);
});

test('stream cancellation stops the child and keeps the cancellation reason', async () => {
    await using sandbox = await testdir();
    const controller = new AbortController();
    const reason = new Error('Canceled native output');
    let pid = 0;
    const command = [
        process.execPath,
        '-e',
        'process.stdout.write(String(process.pid)); setInterval(() => process.stdout.write("pending"), 1000);',
    ];
    expect(
        run(
            command,
            {
                ...prepareCommand(command, { cwd: sandbox.path }).options,
                cancelSignal: controller.signal,
            },
            async (chunks) => {
                for await (const chunk of chunks) {
                    pid = Number(chunk.toString());
                    expect(pid).toBeGreaterThan(0);
                    controller.abort(reason);
                }
            },
        ),
    ).rejects.toBe(reason);
    expect(controller.signal.aborted).toBe(true);
    await waitForExit(pid);
});

test('a finished stream keeps the reader error after cleanup', async () => {
    await using sandbox = await testdir();
    const refusal = new Error('Invalid native stream');
    const command = [process.execPath, '-e', 'process.stdout.write("invalid");'];
    expect(
        run(command, { ...prepareCommand(command, { cwd: sandbox.path }).options }, async (chunks) => {
            for await (const chunk of chunks) expect(chunk.toString()).toBe('invalid');
            throw refusal;
        }),
    ).rejects.toBe(refusal);
});
