import { join } from 'node:path';
import { testdir } from 'testdirs';
import * as filesystem from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { UNSAFE_PATH_MESSAGE } from '#tests/config/messages.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { link, stat, symlink, readFile } from 'node:fs/promises';
import { OUTSIDE_LINKS, MODE_REPLACEMENTS } from '#tests/config/system/files/open.ts';

test.skipIf(isWindows)(
    'the system path format keeps POSIX names the portable rules refuse, and reads a link as the link itself',
    async () => {
        await using sandbox = await testdir();
        using root = openFiles(sandbox.path);
        const path = 'folder/a\n"é:?.txt';
        const previous = { bytes: Buffer.from('inside'), mode: 0o640 };
        root.write(path, previous, undefined);
        expect(root.read(path)).toStrictEqual(previous);
        const link = { bytes: Buffer.from(path), mode: 0o777, isSymlink: true as const };
        await symlink(path, join(sandbox.path, 'linked'));
        expect(root.readKeepingLinks('linked')).toStrictEqual(link);
    },
);

test.each(['../outside', '/outside', 'folder/../outside', 'nul\0suffix'])(
    'system paths refuse the escape %j',
    async (path) => {
        await using sandbox = await testdir();
        using root = openFiles(sandbox.path);
        expect(() => {
            root.write(path, { bytes: Buffer.from('inside'), mode: 0o640 }, undefined);
        }).toThrow(UNSAFE_PATH_MESSAGE);
    },
);

test('deleteFolder refuses linked and outside parents and keeps folders that are not empty', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/kept/value': 'external' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    using files = openFiles(root);
    expect(() => {
        files.deleteFolder('linked/kept');
    }).toThrow(
        matchFields({
            message: 'A parent of linked/kept is a link or is not a folder. Choose a folder without links.',
        }),
    );
    expect(() => {
        files.deleteFolder('../outside/kept');
    }).toThrow(
        matchFields({
            message: '"../outside/kept" is not a safe repository-relative path. Choose a path inside the repository.',
        }),
    );
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

test('opening a missing folder throws its ENOENT error', async () => {
    await using sandbox = await testdir();
    expect(() => openFiles(join(sandbox.path, 'missing'))).toThrow(matchFields({ code: 'ENOENT' }));
});

test('a refused file replacement keeps the original bytes and reports a filesystem error with its cause', async () => {
    await using sandbox = await testdir({ 'settings.json': '{"kept":true}' });
    using files = openFiles(sandbox.path);
    const previous = files.read('settings.json')!;
    const denied = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    using _rename = spyOn(filesystem, 'renameSync').mockImplementation(() => {
        throw denied;
    });
    expect(() => {
        files.write('settings.json', { ...previous, bytes: Buffer.from('{}') }, previous);
    }).toThrow(
        matchFields({
            code: 'filesystem',
            message:
                'Cannot write settings.json. Check its permissions and whether the filesystem is read-only, then run the command again.',
            cause: denied,
        }),
    );
    expect(files.read('settings.json')?.bytes).toEqual(previous.bytes);
    expect(files.list('')).toStrictEqual(['settings.json']);
});

test.each(MODE_REPLACEMENTS.filter(({ posix }) => !posix || !isWindows))(
    'write and remove keep the file modes $original/$replacement and refuse a file that changed since it was read',
    async ({ original: previousMode, replacement: replacementMode, content }) => {
        await using sandbox = await testdir();
        using root = openFiles(sandbox.path);
        const previous = { bytes: Buffer.from([0, 255, 10]), mode: normalizeFileMode({ mode: previousMode }) };
        const replacement = { bytes: Buffer.from(content), mode: normalizeFileMode({ mode: replacementMode }) };
        root.write('config/input', previous, undefined);
        expect(root.read('config/input')).toStrictEqual(previous);
        root.write('config/input', replacement, previous);
        expect(root.read('config/input')).toStrictEqual(replacement);
        expect(() => {
            root.write('config/input', previous, previous);
        }).toThrow(matchFields({ message: 'config/input changed while gspot wrote it. Run the command again.' }));
        expect(() => {
            root.deleteFile('config/input', previous);
        }).toThrow(matchFields({ message: 'config/input changed before removal. Run the command again.' }));
        expect(root.read('config/input')).toStrictEqual(replacement);
        root.write('config/input', previous, replacement);
        expect(() => {
            root.deleteFile('config/input', replacement);
        }).toThrow(matchFields({ message: 'config/input changed before removal. Run the command again.' }));
        expect(root.read('config/input')).toStrictEqual(previous);
        root.deleteFile('config/input', previous);
        expect(root.read('config/input')).toBeUndefined();
        root.write('config/input', replacement, undefined);
        root.deleteFile('config/input', replacement);
        expect(root.read('config/input')).toBeUndefined();
    },
);

test.skipIf(isWindows).each([...OUTSIDE_LINKS])(
    'path $path cannot change a file outside the folder',
    async ({ path, refusal }) => {
        await using sandbox = await testdir({ 'project/.keep': '', 'outside/sentinel': 'authored\n' });

        const outside = join(sandbox.path, 'outside');
        const project = join(sandbox.path, 'project');
        await symlink(outside, join(project, 'escape'));
        await symlink(join(outside, 'sentinel'), join(project, 'linked'));
        using root = openFiles(project);
        expect(() => {
            root.write(path, { bytes: Buffer.from('lost'), mode: 0o600 }, undefined);
        }).toThrow(refusal);
        expect(() => {
            root.deleteFile(path, { bytes: Buffer.from('authored\n'), mode: 0o644 });
        }).toThrow(path === 'linked' ? 'changed before removal' : refusal);
        expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
    },
);

test.skipIf(isWindows)('createFolder sets the folder mode', async () => {
    await using sandbox = await testdir();
    using files = openFiles(sandbox.path);
    files.createFolder(`${GSPOT_PATHS.state}/private`, 0o700);
    const attributes = await stat(join(sandbox.path, `${GSPOT_PATHS.state}/private`));
    expect(attributes.mode & 0o777).toBe(0o700);
});

test('writing one hard link replaces its path and keeps the peer bytes', async () => {
    await using sandbox = await testdir({ 'peer.txt': 'authored\n' });
    await link(join(sandbox.path, 'peer.txt'), join(sandbox.path, 'chosen.txt'));
    using files = openFiles(sandbox.path);
    const previous = files.read('chosen.txt')!;
    files.write('chosen.txt', { bytes: Buffer.from('replacement\n'), mode: 0o644 }, previous);
    expect(await readFile(join(sandbox.path, 'chosen.txt'), 'utf8')).toBe('replacement\n');
    expect(await readFile(join(sandbox.path, 'peer.txt'), 'utf8')).toBe('authored\n');
});
