import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { STATE_PATH } from '#cli/config/gspot-paths.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { stat, mkdir, rmdir, readFile } from 'node:fs/promises';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';

test('a lock released while its create fails is taken on the retry', async () => {
    await using sandbox = await testdir({
        [`${STATE_PATH}/writer.lock`]: `${String(process.pid)}:first`,
        source: 'kept',
    });

    const target = join(sandbox.path, `${STATE_PATH}/writer.lock`);
    {
        using files = openFiles(sandbox.path);
        const publish = fs.linkSync;
        using boundaries = new DisposableStack();
        boundaries.use(
            spyOn(fs, 'linkSync').mockImplementationOnce((source, destination) => {
                try {
                    publish(source, destination);
                } catch (error) {
                    fs.unlinkSync(target);
                    throw error;
                }
            }),
        );
        files.createLock(`${STATE_PATH}/writer.lock`);
        expect(await readFile(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
    }
    expect(await isOnDisk(target)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});
test('a live lock written during the dead-holder check survives', async () => {
    await using sandbox = await testdir();
    const stale = `${readExitedProcessId()}:stale`;
    const live = `${String(process.pid)}:live`;
    await createFileTree(sandbox.path, { [`${STATE_PATH}/writer.lock`]: stale, source: 'kept' });
    const target = join(sandbox.path, `${STATE_PATH}/writer.lock`);
    {
        using files = openFiles(sandbox.path);
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
            files.createLock(`${STATE_PATH}/writer.lock`);
        }).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `Another gspot command, process ${String(process.pid)}, holds ${STATE_PATH}/writer.lock. Retry after it finishes, or delete ${STATE_PATH}/writer.lock when no gspot command is running.`,
            }),
        );
        expect(await readFile(target, 'utf8')).toBe(live);
        expect(await isOnDisk(`${target}.reclaim`)).toBe(false);
    }
    expect(await readFile(target, 'utf8')).toBe(live);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

/** Read a child process ID after the child has exited. */
function readExitedProcessId(): string {
    const child = runCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: process.cwd() });
    if (child.code !== 0) throw new Error(child.stderr);
    return child.stdout.trim();
}
test('the recovery folder refuses a second recovery until the first one ends', async () => {
    await using sandbox = await testdir();
    const stale = `${readExitedProcessId()}:stale`;
    await createFileTree(sandbox.path, { [`${STATE_PATH}/writer.lock`]: stale, source: 'kept' });
    const target = join(sandbox.path, `${STATE_PATH}/writer.lock`);
    await mkdir(`${target}.reclaim`);
    {
        using files = openFiles(sandbox.path);
        expect(() => {
            files.createLock(`${STATE_PATH}/writer.lock`);
        }).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `Another process is recovering ${STATE_PATH}/writer.lock. Retry after it finishes. If no gspot command is running, remove ${STATE_PATH}/writer.lock.reclaim.`,
                cause: expect.any(Error),
            }),
        );
        expect(await readFile(target, 'utf8')).toBe(stale);
        const attributes = await stat(`${target}.reclaim`);
        expect(attributes.isDirectory()).toBe(true);
        await rmdir(`${target}.reclaim`);
        files.createLock(`${STATE_PATH}/writer.lock`);
        expect(await readFile(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
        expect(await isOnDisk(`${target}.reclaim`)).toBe(false);
    }
    expect(await isOnDisk(target)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});
test('a second writer is refused until the first releases the lock', async () => {
    await using sandbox = await testdir({ source: 'kept' });

    const path = `${STATE_PATH}/writer.lock`;
    {
        using second = openFiles(sandbox.path);
        {
            using first = openFiles(sandbox.path);
            first.createLock(path);
            const firstToken = first.read(path)?.bytes.toString('utf8');
            expect(firstToken).toStartWith(`${String(process.pid)}:`);
            expect(() => {
                second.createLock(path);
            }).toThrow(
                matchFields<GspotError>({
                    name: 'GspotError',
                    code: 'filesystem',
                    message: `Another gspot command, process ${String(process.pid)}, holds ${path}. Retry after it finishes, or delete ${path} when no gspot command is running.`,
                }),
            );
            expect(second.read(path)?.bytes.toString('utf8')).toBe(firstToken);
        }
        expect(second.read(path)).toBeUndefined();
        second.createLock(path);
        expect(second.read(path)?.bytes.toString('utf8')).toStartWith(`${String(process.pid)}:`);
    }
    using files = openFiles(sandbox.path);
    expect(files.read(path)).toBeUndefined();
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});
test.each(['garbage', '0'])(
    'a lock whose holder field is not a process ID is refused with the live-holder message (%s)',
    async (holder) => {
        await using sandbox = await testdir();
        const path = `${STATE_PATH}/writer.lock`;
        await createFileTree(sandbox.path, { [path]: holder, source: 'kept' });
        using files = openFiles(sandbox.path);
        expect(() => {
            files.createLock(path);
        }).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `${path} names no gspot process. Delete ${path} when no gspot command is running.`,
            }),
        );
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(holder);
        expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
    },
);
