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
import { MODE_REPLACEMENTS } from '#tests/config/system/files/open.ts';

test.skipIf(isWindows)(
    'the system path format keeps POSIX names the portable rules refuse, and reads a link as the link itself',
    async () => {
        await using sandbox = await testdir();
        const root = openFiles(sandbox.path);
        const path = 'folder/a\n"é:?.txt';
        const previous = { bytes: Buffer.from('inside'), mode: 0o640 };
        root.write(path, previous);
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
        const root = openFiles(sandbox.path);
        expect(() => {
            root.write(path, { bytes: Buffer.from('inside'), mode: 0o640 });
        }).toThrow(UNSAFE_PATH_MESSAGE);
    },
);

test('deleteFolder refuses linked and outside parents and keeps folders that are not empty', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/kept/value': 'external' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    const files = openFiles(root);
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
    files.write('cache/kept/value', { bytes: Buffer.from('retained'), mode: 0o600 });
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
    const files = openFiles(sandbox.path);
    const previous = files.read('settings.json')!;
    const denied = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    using _rename = spyOn(filesystem, 'renameSync').mockImplementation(() => {
        throw denied;
    });
    expect(() => {
        files.write('settings.json', { ...previous, bytes: Buffer.from('{}') });
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
    'write and remove keep the file modes $original/$replacement',
    async ({ original: previousMode, replacement: replacementMode, content }) => {
        await using sandbox = await testdir();
        const root = openFiles(sandbox.path);
        const previous = { bytes: Buffer.from([0, 255, 10]), mode: normalizeFileMode({ mode: previousMode }) };
        const replacement = { bytes: Buffer.from(content), mode: normalizeFileMode({ mode: replacementMode }) };
        root.write('config/input', previous);
        expect(root.read('config/input')).toStrictEqual(previous);
        root.write('config/input', replacement);
        expect(root.read('config/input')).toStrictEqual(replacement);
        root.write('config/input', previous);
        expect(root.read('config/input')).toStrictEqual(previous);
        root.deleteFile('config/input');
        expect(root.read('config/input')).toBeUndefined();
    },
);

test.skipIf(isWindows)('a linked parent folder refuses writes and removals of a file outside the folder', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/sentinel': 'authored\n' });
    const outside = join(sandbox.path, 'outside');
    const project = join(sandbox.path, 'project');
    await symlink(outside, join(project, 'escape'));
    const root = openFiles(project);
    const refusal = 'A parent of escape/sentinel is a link or is not a folder. Choose a folder without links.';
    expect(() => {
        root.write('escape/sentinel', { bytes: Buffer.from('lost'), mode: 0o600 });
    }).toThrow(refusal);
    expect(() => {
        root.deleteFile('escape/sentinel');
    }).toThrow(refusal);
    expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
});

test.skipIf(isWindows)('writing and removing a linked file replace the link and keep the file it names', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/sentinel': 'authored\n' });
    const project = join(sandbox.path, 'project');
    await symlink(join(sandbox.path, 'outside/sentinel'), join(project, 'linked'));
    const root = openFiles(project);
    const written = { bytes: Buffer.from('lost'), mode: 0o600 };
    root.write('linked', written);
    expect(root.readKeepingLinks('linked')).toStrictEqual(written);
    root.deleteFile('linked');
    expect(root.readStats('linked')).toBeUndefined();
    expect(await readFile(join(sandbox.path, 'outside/sentinel'), 'utf8')).toBe('authored\n');
});

test.skipIf(isWindows)('createFolder sets the folder mode', async () => {
    await using sandbox = await testdir();
    const files = openFiles(sandbox.path);
    files.createFolder(`${GSPOT_PATHS.state}/private`, 0o700);
    const attributes = await stat(join(sandbox.path, `${GSPOT_PATHS.state}/private`));
    expect(attributes.mode & 0o777).toBe(0o700);
});

test('writing one hard link replaces its path and keeps the peer bytes', async () => {
    await using sandbox = await testdir({ 'peer.txt': 'authored\n' });
    await link(join(sandbox.path, 'peer.txt'), join(sandbox.path, 'chosen.txt'));
    const files = openFiles(sandbox.path);
    files.write('chosen.txt', { bytes: Buffer.from('replacement\n'), mode: 0o644 });
    expect(await readFile(join(sandbox.path, 'chosen.txt'), 'utf8')).toBe('replacement\n');
    expect(await readFile(join(sandbox.path, 'peer.txt'), 'utf8')).toBe('authored\n');
});
