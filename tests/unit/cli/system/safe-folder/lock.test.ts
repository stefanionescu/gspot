import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { stat, mkdir, rmdir, readFile } from 'node:fs/promises';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { STATE_DIRECTORY } from '#cli/config/system/locations.ts';

test('a lock removed after a failed create can be taken', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        [`${STATE_DIRECTORY}/writer.lock`]: `${String(process.pid)}:first`,
        source: 'kept',
    });
    const target = join(sandbox.path, `${STATE_DIRECTORY}/writer.lock`);
    {
        using files = openSafeFolder(sandbox.path);
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
        files.claim(`${STATE_DIRECTORY}/writer.lock`);
        expect(await readFile(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
    }
    expect(await pathExists(target)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('a live lock written during the dead-holder check survives', async () => {
    await using sandbox = await testdir();
    const child = runCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: sandbox.path });
    expect(child.code, child.stderr).toBe(0);
    const stale = `${child.stdout.trim()}:stale`;
    const live = `${String(process.pid)}:live`;
    await createFileTree(sandbox.path, { [`${STATE_DIRECTORY}/writer.lock`]: stale, source: 'kept' });
    const target = join(sandbox.path, `${STATE_DIRECTORY}/writer.lock`);
    {
        using files = openSafeFolder(sandbox.path);
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
            files.claim(`${STATE_DIRECTORY}/writer.lock`);
        }).toThrow('Another gspot command');
        expect(await readFile(target, 'utf8')).toBe(live);
        expect(await pathExists(`${target}.reclaim`)).toBe(false);
    }
    expect(await readFile(target, 'utf8')).toBe(live);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('the recovery folder refuses a second recovery until the first one ends', async () => {
    await using sandbox = await testdir();
    const child = runCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: sandbox.path });
    expect(child.code, child.stderr).toBe(0);
    const stale = `${child.stdout.trim()}:stale`;
    await createFileTree(sandbox.path, { [`${STATE_DIRECTORY}/writer.lock`]: stale, source: 'kept' });
    const target = join(sandbox.path, `${STATE_DIRECTORY}/writer.lock`);
    await mkdir(`${target}.reclaim`);
    {
        using files = openSafeFolder(sandbox.path);
        expect(() => {
            files.claim(`${STATE_DIRECTORY}/writer.lock`);
        }).toThrow('Another process is recovering');
        expect(await readFile(target, 'utf8')).toBe(stale);
        const attributes = await stat(`${target}.reclaim`);
        expect(attributes.isDirectory()).toBe(true);
        await rmdir(`${target}.reclaim`);
        files.claim(`${STATE_DIRECTORY}/writer.lock`);
        expect(await readFile(target, 'utf8')).toStartWith(`${String(process.pid)}:`);
        expect(await pathExists(`${target}.reclaim`)).toBe(false);
    }
    expect(await pathExists(target)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('a second writer is refused until the first releases the lock', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { source: 'kept' });
    const path = `${STATE_DIRECTORY}/writer.lock`;
    {
        using second = openSafeFolder(directory.path);
        {
            using first = openSafeFolder(directory.path);
            first.claim(path);
            const firstToken = first.read(path)?.bytes.toString('utf8');
            expect(firstToken).toStartWith(`${String(process.pid)}:`);
            expect(() => {
                second.claim(path);
            }).toThrow('Another gspot command');
            expect(second.read(path)?.bytes.toString('utf8')).toBe(firstToken);
        }
        expect(second.read(path)).toBeUndefined();
        expect(() => {
            second.claim(path);
        }).not.toThrow();
        expect(second.read(path)?.bytes.toString('utf8')).toStartWith(`${String(process.pid)}:`);
    }
    using files = openSafeFolder(directory.path);
    expect(files.read(path)).toBeUndefined();
    expect(await readFile(join(directory.path, 'source'), 'utf8')).toBe('kept');
});
