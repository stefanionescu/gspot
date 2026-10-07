// On Bun, exercise claim handoffs through real filesystem and process boundaries.
import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openRoot } from '#cli/platform/root/open.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { READY_POLL_MS } from '#tests/config/harness/process.ts';
import { STATE_DIRECTORY } from '#cli/config/platform/locations.ts';
import { waitForFile, captureChild } from '#tests/harness/process.ts';
import { prepareTestCommand, runTestCommandBlocking } from '#tests/harness/command.ts';

test('a claim released after exclusive creation fails can be acquired', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/mutation.lock': `${String(process.pid)}:first`, source: 'kept' });
    const target = join(sandbox.path, '.gspot/mutation.lock');
    using files = openRoot(sandbox.path);
    const write = fs.writeFileSync;
    using boundaries = new DisposableStack();
    boundaries.use(
        spyOn(fs, 'writeFileSync').mockImplementationOnce((path, content, options) => {
            try {
                write(path, content, options);
            } catch (error) {
                fs.unlinkSync(target);
                throw error;
            }
        }),
    );
    files.claim('.gspot/mutation.lock');
    expect(fs.readFileSync(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
    files.close();
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readFileSync(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('a live replacement survives a stale holder check', async () => {
    await using sandbox = await testdir();
    const child = runTestCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: sandbox.path });
    expect(child.code, child.stderr).toBe(0);
    const stale = `${child.stdout.trim()}:stale`;
    const live = `${String(process.pid)}:live`;
    await createFileTree(sandbox.path, { '.gspot/mutation.lock': stale, source: 'kept' });
    const target = join(sandbox.path, '.gspot/mutation.lock');
    using files = openRoot(sandbox.path);
    const kill = process.kill.bind(process);
    using boundaries = new DisposableStack();
    boundaries.use(
        spyOn(process, 'kill').mockImplementationOnce((pid, signal) => {
            try {
                return kill(pid, signal);
            } catch (error) {
                fs.writeFileSync(target, live);
                throw error;
            }
        }),
    );
    expect(() => {
        files.claim('.gspot/mutation.lock');
    }).toThrow('Another lifecycle writer');
    expect(fs.readFileSync(target, 'utf8')).toBe(live);
    expect(fs.existsSync(`${target}.reclaim`)).toBe(false);
    files.close();
    expect(fs.readFileSync(target, 'utf8')).toBe(live);
    expect(fs.readFileSync(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('an empty claim can finish initialization while another writer waits', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/kept': 'kept', source: 'authored' });
    const target = join(sandbox.path, '.gspot/mutation.lock');
    const ready = join(sandbox.path, 'ready');
    const release = join(sandbox.path, 'initialize');
    const program = `
import { writeFileSync, existsSync } from 'node:fs';
const target = ${JSON.stringify(target)};
writeFileSync(target, '', { flag: 'wx' });
writeFileSync(${JSON.stringify(ready)}, 'ready');
while (!existsSync(${JSON.stringify(release)})) await Bun.sleep(${String(READY_POLL_MS)});
writeFileSync(target, String(process.pid) + ':initialized');
console.log('initialized');
await Bun.stdin.text();`;
    const command = [process.execPath, '-e', program];
    const prepared = prepareTestCommand(command, { cwd: sandbox.path }, 'claim initialization');
    const child = Bun.spawn(command, {
        cwd: sandbox.path,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: prepared.options.timeoutMs,
        killSignal: 'SIGKILL',
    });
    await using children = new AsyncDisposableStack();
    children.use(captureChild(child));
    expect(await waitForFile(ready)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('');
    const write = fs.writeFileSync;
    using boundaries = new DisposableStack();
    boundaries.use(
        spyOn(fs, 'writeFileSync').mockImplementationOnce((path, content, options) => {
            try {
                write(path, content, options);
            } catch (error) {
                write(release, 'initialize');
                throw error;
            }
        }),
    );
    using files = openRoot(sandbox.path);
    expect(() => {
        files.claim('.gspot/mutation.lock');
    }).toThrow('Another lifecycle writer');
    expect(fs.readFileSync(target, 'utf8')).toBe(`${String(child.pid)}:initialized`);
    files.close();
    expect(fs.readFileSync(target, 'utf8')).toBe(`${String(child.pid)}:initialized`);
    expect(fs.readFileSync(join(sandbox.path, 'source'), 'utf8')).toBe('authored');
});

test('a recovery lease refuses a competing reclaimer until recovery finishes', async () => {
    await using sandbox = await testdir();
    const child = runTestCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: sandbox.path });
    expect(child.code, child.stderr).toBe(0);
    const stale = `${child.stdout.trim()}:stale`;
    await createFileTree(sandbox.path, { '.gspot/mutation.lock': stale, source: 'kept' });
    const target = join(sandbox.path, '.gspot/mutation.lock');
    fs.mkdirSync(`${target}.reclaim`);
    using files = openRoot(sandbox.path);
    expect(() => {
        files.claim('.gspot/mutation.lock');
    }).toThrow('Another process is recovering');
    expect(fs.readFileSync(target, 'utf8')).toBe(stale);
    expect(fs.statSync(`${target}.reclaim`).isDirectory()).toBe(true);
    fs.rmdirSync(`${target}.reclaim`);
    files.claim('.gspot/mutation.lock');
    expect(fs.readFileSync(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
    expect(fs.existsSync(`${target}.reclaim`)).toBe(false);
    files.close();
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readFileSync(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('an abandoned empty claim stays intact until its owner is checked and removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.gspot/mutation.lock': '', source: 'kept' });
    const target = join(sandbox.path, '.gspot/mutation.lock');
    using files = openRoot(sandbox.path);
    expect(() => {
        files.claim('.gspot/mutation.lock');
    }).toThrow('Lifecycle claim is being initialized');
    expect(fs.readFileSync(target, 'utf8')).toBe('');
    files.close();
    expect(fs.existsSync(target)).toBe(true);
    fs.unlinkSync(target);
    files.claim('.gspot/mutation.lock');
    expect(fs.readFileSync(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
    files.close();
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readFileSync(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test.skipIf(!isPosix)(
    'root lifecycle mutations: a second writer is refused until the first releases its claim',
    async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { source: 'kept' });
        const path = `${STATE_DIRECTORY}/writer.lock`;
        const first = openRoot(directory.path);
        const second = openRoot(directory.path);
        try {
            first.claim(path);
            const firstToken = first.read(path)?.bytes.toString('utf8');
            expect(firstToken).toStartWith(`${String(process.pid)}:`);
            expect(() => {
                second.claim(path);
            }).toThrow('Another lifecycle writer');
            expect(second.read(path)?.bytes.toString('utf8')).toBe(firstToken);
            first.close();
            expect(second.read(path)).toBeUndefined();
            expect(() => {
                second.claim(path);
            }).not.toThrow();
            expect(second.read(path)?.bytes.toString('utf8')).toStartWith(`${String(process.pid)}:`);
            second.close();
            expect(second.read(path)).toBeUndefined();
            expect(fs.readFileSync(join(directory.path, 'source'), 'utf8')).toBe('kept');
        } finally {
            first.close();
            second.close();
        }
    },
);
