import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openFiles } from '#cli/system/files/open.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { assertWritablePath } from '#cli/system/files/names.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { link, stat, symlink, readFile } from 'node:fs/promises';
import { matchFields, captureThrow } from '#tests/setup/matchers.ts';
import { OUTSIDE_LINKS, MODE_REPLACEMENTS } from '#tests/data/system/files/open.ts';

// Windows file names cannot contain a newline, quote, or colon.
test.skipIf(isWindows)(
    'the system path format keeps POSIX names the portable rules refuse, and refuses links to gspot state',
    async () => {
        await using sandbox = await testdir();
        using root = openFiles(sandbox.path);
        const path = 'folder/a\n"é:?.txt';
        const original = { bytes: Buffer.from('inside'), mode: 0o640 };
        root.write(path, original, undefined);
        expect(root.read(path)).toStrictEqual(original);
        expect(
            captureThrow(() => {
                assertWritablePath(path);
            }),
        ).toBe(
            '"folder/a\\n\\"\u00E9:?.txt" is not a safe repository-relative path. Choose a path inside the repository.',
        );
        const link = { bytes: Buffer.from(path), mode: 0o777, isLink: true as const };
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
        }).toThrow('is not a safe repository-relative path');
    },
);
test('deleteFolder refuses linked and outside parents and keeps folders that are not empty', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/kept/value': 'external' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    using files = openFiles(root);
    expect(() => {
        files.deleteFolder('linked/kept');
    }).toThrow(new Error('A parent of linked/kept is a link or is not a directory. Choose a directory without links.'));
    expect(
        captureThrow(() => {
            files.deleteFolder('../outside/kept');
        }),
    ).toBe('"../outside/kept" is not a safe repository-relative path. Choose a path inside the repository.');
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
test.each(MODE_REPLACEMENTS.filter(({ posix }) => !posix || !isWindows))(
    'write and remove keep the file modes $original/$replacement and refuse a file that changed since it was read',
    async ({ original: originalMode, replacement: replacementMode, content }) => {
        await using sandbox = await testdir();
        using root = openFiles(sandbox.path);
        const original = { bytes: Buffer.from([0, 255, 10]), mode: normalizeFileMode({ mode: originalMode }) };
        const replacement = { bytes: Buffer.from(content), mode: normalizeFileMode({ mode: replacementMode }) };
        root.write('config/input', original, undefined);
        expect(root.read('config/input')).toStrictEqual(original);
        root.write('config/input', replacement, original);
        expect(root.read('config/input')).toStrictEqual(replacement);
        expect(() => {
            root.write('config/input', original, original);
        }).toThrow(new Error('Destination changed during the operation: config/input'));
        expect(
            captureThrow(() => {
                root.deleteFile('config/input', original);
            }),
        ).toBe('config/input changed before removal. Run the command again.');
        expect(root.read('config/input')).toStrictEqual(replacement);
        root.write('config/input', original, replacement);
        expect(
            captureThrow(() => {
                root.deleteFile('config/input', replacement);
            }),
        ).toBe('config/input changed before removal. Run the command again.');
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
        await using sandbox = await testdir({ 'project/.keep': '', 'outside/sentinel': 'authored\n' });

        const outside = join(sandbox.path, 'outside');
        const project = join(sandbox.path, 'project');
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
