import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { STATE_PATH } from '#cli/config/system/locations.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { assertWritablePath } from '#cli/system/files/names.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { link, stat, mkdir, rmdir, symlink, readFile } from 'node:fs/promises';
import { OUTSIDE_LINKS, PORTABLE_PATHS, MODE_REPLACEMENTS } from '#tests/data/system.ts';

test('a lock removed after a failed create can be taken', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
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
    const child = runCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: sandbox.path });
    expect(child.code, child.stderr).toBe(0);
    const stale = `${child.stdout.trim()}:stale`;
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
        }).toThrow('Another gspot command');
        expect(await readFile(target, 'utf8')).toBe(live);
        expect(await isOnDisk(`${target}.reclaim`)).toBe(false);
    }
    expect(await readFile(target, 'utf8')).toBe(live);
    expect(await readFile(join(sandbox.path, 'source'), 'utf8')).toBe('kept');
});

test('the recovery folder refuses a second recovery until the first one ends', async () => {
    await using sandbox = await testdir();
    const child = runCommandBlocking([process.execPath, '-e', 'console.log(process.pid)'], { cwd: sandbox.path });
    expect(child.code, child.stderr).toBe(0);
    const stale = `${child.stdout.trim()}:stale`;
    await createFileTree(sandbox.path, { [`${STATE_PATH}/writer.lock`]: stale, source: 'kept' });
    const target = join(sandbox.path, `${STATE_PATH}/writer.lock`);
    await mkdir(`${target}.reclaim`);
    {
        using files = openFiles(sandbox.path);
        expect(() => {
            files.createLock(`${STATE_PATH}/writer.lock`);
        }).toThrow('Another process is recovering');
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
    await using folder = await testdir();
    await createFileTree(folder.path, { source: 'kept' });
    const path = `${STATE_PATH}/writer.lock`;
    {
        using second = openFiles(folder.path);
        {
            using first = openFiles(folder.path);
            first.createLock(path);
            const firstToken = first.read(path)?.bytes.toString('utf8');
            expect(firstToken).toStartWith(`${String(process.pid)}:`);
            expect(() => {
                second.createLock(path);
            }).toThrow('Another gspot command');
            expect(second.read(path)?.bytes.toString('utf8')).toBe(firstToken);
        }
        expect(second.read(path)).toBeUndefined();
        second.createLock(path);
        expect(second.read(path)?.bytes.toString('utf8')).toStartWith(`${String(process.pid)}:`);
    }
    using files = openFiles(folder.path);
    expect(files.read(path)).toBeUndefined();
    expect(await readFile(join(folder.path, 'source'), 'utf8')).toBe('kept');
});

// Windows file names cannot contain a newline, quote, or colon.
test.skipIf(isWindows)(
    'the system path format keeps POSIX names the portable rules refuse, and refuses links to gspot state',
    async () => {
        await using folder = await testdir();
        using root = openFiles(folder.path);
        const path = 'folder/a\n"é:?.txt';
        const original = { bytes: Buffer.from('inside'), mode: 0o640 };
        root.write(path, original, undefined);
        expect(root.read(path)).toStrictEqual(original);
        expect(() => {
            assertWritablePath(path);
        }).toThrow('is not a safe repository-relative path');
        const link = { bytes: Buffer.from(path), mode: 0o777, isLink: true as const };
        await symlink(path, join(folder.path, 'linked'));
        expect(root.readKeepingLinks('linked')).toStrictEqual(link);
    },
);

test.each(['../outside', '/outside', 'folder/../outside', 'nul\0suffix'])(
    'system paths refuse the escape %j',
    async (path) => {
        await using folder = await testdir();
        using root = openFiles(folder.path);
        expect(() => {
            root.write(path, { bytes: Buffer.from('inside'), mode: 0o640 }, undefined);
        }).toThrow('is not a safe repository-relative path');
    },
);

test.each([...PORTABLE_PATHS])('portable paths refuse $path: $refused', ({ path, refused }) => {
    const write = () => {
        assertWritablePath(path);
    };
    if (refused) expect(write).toThrow('is not a safe repository-relative path');
    else expect(write).not.toThrow();
});

test('rmdir refuses linked and outside parents and keeps folders that are not empty', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/kept/value': 'external' });
    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    using files = openFiles(root);
    expect(() => {
        files.deleteFolder('linked/kept');
    }).toThrow('is a link or is not a directory');
    expect(() => {
        files.deleteFolder('../outside/kept');
    }).toThrow('is not a safe repository-relative path');
    files.createFolder('cache/empty', 0o700);
    files.deleteFolder('cache/empty');
    expect(files.readStats('cache/empty')).toBeUndefined();
    files.write('cache/kept/value', { bytes: Buffer.from('retained'), mode: 0o600 }, undefined);
    expect(() => {
        files.deleteFolder('cache/kept');
    }).toThrow('ENOTEMPTY');
    expect(files.read('cache/kept/value')?.bytes.toString()).toBe('retained');
    expect(await readFile(join(sandbox.path, 'outside/kept/value'), 'utf8')).toBe('external');
});

test('a missing folder keeps its ENOENT error', async () => {
    await using sandbox = await testdir();
    const failure: unknown = await Promise.resolve()
        .then(() => openFiles(join(sandbox.path, 'missing')))
        .catch((error: unknown) => error);
    expect(failure).toMatchObject({
        code: 'ENOENT',
    });
});

test.each(MODE_REPLACEMENTS.filter(({ posix }) => !posix || !isWindows))(
    'write and remove keep the file modes $original/$replacement and refuse a stale expected copy',
    async ({ original: originalMode, replacement: replacementMode, content }) => {
        await using folder = await testdir();
        using root = openFiles(folder.path);
        const original = { bytes: Buffer.from([0, 255, 10]), mode: normalizeFileMode({ mode: originalMode }) };
        const replacement = { bytes: Buffer.from(content), mode: normalizeFileMode({ mode: replacementMode }) };
        root.write('config/input', original, undefined);
        expect(root.read('config/input')).toStrictEqual(original);
        root.write('config/input', replacement, original);
        expect(root.read('config/input')).toStrictEqual(replacement);
        expect(() => {
            root.write('config/input', original, original);
        }).toThrow('changed');
        expect(() => {
            root.deleteFile('config/input', original);
        }).toThrow('changed');
        expect(root.read('config/input')).toStrictEqual(replacement);
        root.write('config/input', original, replacement);
        expect(() => {
            root.deleteFile('config/input', replacement);
        }).toThrow('changed');
        expect(root.read('config/input')).toStrictEqual(original);
        root.deleteFile('config/input', original);
        expect(root.read('config/input')).toBeUndefined();
        root.write('config/input', replacement, undefined);
        root.deleteFile('config/input', replacement);
        expect(root.read('config/input')).toBeUndefined();
    },
);

// Windows symbolic links require privileges these tests do not request.
test.skipIf(isWindows).each([...OUTSIDE_LINKS])(
    'path $path cannot change a file outside the folder',
    async ({ path, refusal }) => {
        await using folder = await testdir();
        await createFileTree(folder.path, { 'project/.keep': '', 'outside/sentinel': 'authored\n' });
        const outside = join(folder.path, 'outside');
        const project = join(folder.path, 'project');
        await symlink(outside, join(project, 'escape'));
        await symlink(join(outside, 'sentinel'), join(project, 'linked'));
        await link(join(outside, 'sentinel'), join(project, 'hardlinked'));
        using root = openFiles(project);
        expect(() => {
            root.write(path, { bytes: Buffer.from('lost'), mode: 0o600 }, undefined);
        }).toThrow(refusal);
        expect(() => {
            root.deleteFile(path, { bytes: Buffer.from('authored\n'), mode: 0o644 });
        }).toThrow(path === 'linked' ? 'changed before removal' : refusal);
        expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
        root.createFolder('.gspot/state/private', 0o700);
        const attributes = await stat(join(project, '.gspot/state/private'));
        expect(attributes.mode & 0o777).toBe(0o700);
    },
);
