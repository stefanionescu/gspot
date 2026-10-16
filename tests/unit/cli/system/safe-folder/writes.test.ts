import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openFiles } from '#cli/system/files/open.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { link, stat, symlink, readFile } from 'node:fs/promises';
import { OUTSIDE_LINKS, MODE_REPLACEMENTS, LINK_TARGET_REFUSALS } from '#tests/config/system.ts';

test.each(MODE_REPLACEMENTS.filter(({ posix }) => !posix || !isWindows))(
    'write and remove keep the file modes $original/$replacement and refuse a stale expected copy',
    async ({ original: originalMode, replacement: replacementMode, content }) => {
        await using directory = await testdir();
        using root = openFiles(directory.path);
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
            root.remove('config/input', original);
        }).toThrow('changed');
        expect(root.read('config/input')).toStrictEqual(replacement);
        root.write('config/input', original, replacement);
        expect(() => {
            root.remove('config/input', replacement);
        }).toThrow('changed');
        expect(root.read('config/input')).toStrictEqual(original);
        root.remove('config/input', original);
        expect(root.read('config/input')).toBeUndefined();
        root.write('config/input', replacement, undefined);
        root.remove('config/input', replacement);
        expect(root.read('config/input')).toBeUndefined();
    },
);

// Windows symbolic links require privileges these tests do not request.
test
    .skipIf(isWindows)
    .each((['portable', 'system'] as const).flatMap((format) => OUTSIDE_LINKS.map((entry) => ({ format, ...entry }))))(
    '$format path $path cannot change a file outside the folder',
    async ({ format, path, refusal }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', 'outside/sentinel': 'authored\n' });
        const outside = join(directory.path, 'outside');
        const project = join(directory.path, 'project');
        await symlink(outside, join(project, 'escape'));
        await symlink(join(outside, 'sentinel'), join(project, 'linked'));
        await link(join(outside, 'sentinel'), join(project, 'hardlinked'));
        using root = openFiles(project, format);
        expect(() => {
            root.write(path, { bytes: Buffer.from('lost'), mode: 0o600 }, undefined);
        }).toThrow(refusal);
        expect(() => {
            root.remove(path, { bytes: Buffer.from('authored\n'), mode: 0o644 });
        }).toThrow(refusal);
        expect(await readFile(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
        root.mkdir('.gspot/state/private', 0o700);
        const attributes = await stat(join(project, '.gspot/state/private'));
        expect(attributes.mode & 0o777).toBe(0o700);
    },
);

// Windows symbolic links require privileges these tests do not request.
test.skipIf(isWindows).each([...LINK_TARGET_REFUSALS])(
    'a link write refuses the target $target',
    async ({ target, refusal }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/target': 'inside', 'outside/sentinel': 'outside' });
        const project = join(directory.path, 'project');
        await symlink('../outside', join(project, 'escape'));
        await symlink('../outside/sentinel', join(project, 'escaped-file'));
        using root = openFiles(project);
        expect(() => {
            root.write('tool', { bytes: Buffer.from(target), mode: 0o777, isLink: true }, undefined);
        }).toThrow(refusal);
        expect(root.read('tool')).toBeUndefined();
        expect(await readFile(join(directory.path, 'outside/sentinel'), 'utf8')).toBe('outside');
        const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
        root.write('tool', next, undefined);
        expect(root.readKeepingLinks('tool')).toStrictEqual(next);
        expect(await readFile(join(project, 'tool'), 'utf8')).toBe('inside');
        root.remove('tool', next);
        expect(root.read('tool')).toBeUndefined();
        expect(await readFile(join(project, 'target'), 'utf8')).toBe('inside');
    },
);
