import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { openRoot } from '#cli/platform/root/public.ts';
import { link, stat, symlink, readFile } from 'node:fs/promises';
import { isMacos, isPosix } from '#tests/config/harness/platforms.ts';
import { fileMode, portableSegments } from '#cli/platform/root/contracts.ts';

import {
    ROOT_REPLACEMENTS,
    UNSAFE_DESTINATIONS,
    LINK_TARGET_REFUSALS,
    NATIVE_PATH_REFUSALS,
    POSIX_CANONICAL_ROOT,
    POSIX_CANONICAL_SOURCE,
} from '#tests/config/cli/platform/root.ts';

test.each(ROOT_REPLACEMENTS.filter(({ posix }) => !posix || isPosix))(
    'native replacement and removal preserve modes $original/$replacement and refuse stale writes',
    async ({ original: originalMode, replacement: replacementMode, content }) => {
        await using directory = await testdir();
        using root = openRoot(directory.path);
        const original = { bytes: Buffer.from([0, 255, 10]), mode: fileMode({ mode: originalMode }) };
        const replacement = { bytes: Buffer.from(content), mode: fileMode({ mode: replacementMode }) };
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

test
    .skipIf(!isPosix)
    .each(
        (['portable', 'native'] as const).flatMap((format) =>
            UNSAFE_DESTINATIONS.map((entry) => ({ format, ...entry })),
        ),
    )(
    'root lifecycle mutations: $format path $path cannot change an external file',
    async ({ format, path, refusal }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', 'outside/sentinel': 'authored\n' });
        const outside = join(directory.path, 'outside');
        const project = join(directory.path, 'project');
        await symlink(outside, join(project, 'escape'));
        await symlink(join(outside, 'sentinel'), join(project, 'linked'));
        await link(join(outside, 'sentinel'), join(project, 'hardlinked'));
        using root = openRoot(project, format);
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

test.skipIf(!isPosix)(
    'root lifecycle mutations: native snapshot names retain POSIX bytes while refusing traversal and private links',
    async () => {
        await using directory = await testdir();
        using root = openRoot(directory.path, 'native');
        const path = 'folder/a\n"é:?.txt';
        const original = { bytes: Buffer.from('inside'), mode: 0o640 };
        root.write(path, original, undefined);
        expect(root.read(path)).toStrictEqual(original);
        expect(() => portableSegments(path)).toThrow('Unsafe lifecycle path');
        const link = { bytes: Buffer.from(path), mode: 0o777, isLink: true as const };
        root.write('linked', link, undefined);
        expect(root.readKeepingLinks('linked')).toStrictEqual(link);
        expect(() => {
            root.write('private-link', { ...link, bytes: Buffer.from('.gspot/state/ownership.json') }, undefined);
        }).toThrow('Lifecycle metadata');
    },
);

test.skipIf(!isPosix).each(NATIVE_PATH_REFUSALS)('native paths refuse the escape %j', async (path) => {
    await using directory = await testdir();
    using root = openRoot(directory.path, 'native');
    expect(() => {
        root.write(path, { bytes: Buffer.from('inside'), mode: 0o640 }, undefined);
    }).toThrow('Unsafe lifecycle path');
});

test.skipIf(!isPosix).each(LINK_TARGET_REFUSALS)(
    'root lifecycle mutations: link publication refuses target $target',
    async ({ target, refusal }) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/target': 'inside', 'outside/sentinel': 'outside' });
        const project = join(directory.path, 'project');
        await symlink('../outside', join(project, 'escape'));
        await symlink('../outside/sentinel', join(project, 'escaped-file'));
        using root = openRoot(project);
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

test.each([
    '../outside',
    '/outside',
    'a/../b',
    'a//b',
    'a/./b',
    'C:relative',
    'C:/absolute',
    String.raw`\\server\share`,
    String.raw`a\b`,
    'nul.txt',
    'a/COM1',
    'a.',
    'a ',
    'a\0b',
    '',
])('mutation paths reject the portable escape %j', (path) => {
    expect(() => portableSegments(path)).toThrow('Unsafe lifecycle path');
});

test('mutation paths preserve ordinary Unicode names', () => {
    expect(portableSegments('documents/équipe 50%.md')).toStrictEqual(['documents', 'équipe 50%.md']);
});

test.each([
    [0o600, true],
    [0o640, true],
    [0o644, true],
    [0o755, true],
    [0o777, true],
    [0o400, false],
    [0o440, false],
    [0o444, false],
    [0o555, false],
] as const)('Windows file identity for mode %i retains its writable class', (mode, writable) => {
    const writableMode = fileMode({ mode: 0o600 }, 'win32');
    const readonlyMode = fileMode({ mode: 0o400 }, 'win32');
    expect(writableMode).not.toBe(readonlyMode);
    expect(fileMode({ mode }, 'win32')).toBe(writable ? writableMode : readonlyMode);
    expect(fileMode({ mode }, 'darwin')).toBe(mode);
    expect(fileMode({ mode }, 'linux')).toBe(mode);
    expect(fileMode({ mode: fileMode({ mode }, 'win32') }, 'win32')).toBe(fileMode({ mode }, 'win32'));
    expect(fileMode({ mode, isLink: true }, 'win32')).toBe(writableMode);
});

test('empty-directory removal bounds parents and preserves nonempty directories', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/kept/value': 'external' });
    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    using files = openRoot(root);
    expect(() => {
        files.rmdir('linked/kept');
    }).toThrow('Unsafe lifecycle parent');
    expect(() => {
        files.rmdir('../outside/kept');
    }).toThrow('Unsafe lifecycle path');
    files.mkdir('cache/empty', 0o700);
    files.rmdir('cache/empty');
    expect(files.stat('cache/empty')).toBeUndefined();
    files.write('cache/kept/value', { bytes: Buffer.from('retained'), mode: 0o600 }, undefined);
    expect(() => {
        files.rmdir('cache/kept');
    }).toThrow('ENOTEMPTY');
    expect(files.read('cache/kept/value')?.bytes.toString()).toBe('retained');
    expect(await readFile(join(sandbox.path, 'outside/kept/value'), 'utf8')).toBe('external');
});

test.skipIf(!isMacos)(
    'an existing macOS root reports an unmet runtime prerequisite instead of a missing policy',
    async () => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, POSIX_CANONICAL_ROOT);
        await createFileTree(root, { 'gspot.toml': 'configurations = []\n' });
        const failure: unknown = await Promise.resolve()
            .then(() => openRoot(root, 'native'))
            .catch((error: unknown) => error);
        expect(failure).toMatchObject({
            name: 'GspotError',
            code: 'filesystem',
            message: `The runtime cannot resolve this existing filesystem path: ${root}. Check runtime support for this path.`,
            cause: { code: 'ENOENT' },
        });
        const diagnostic = await runGspot(root, ['list', '--json']);
        expect(diagnostic.code, diagnostic.stdout + diagnostic.stderr).toBe(2);
        const report: unknown = JSON.parse(diagnostic.stdout);
        expect(report).toStrictEqual({
            error: 'filesystem',
            message: `The runtime cannot resolve this existing filesystem path: ${root}. Check runtime support for this path.`,
        });
    },
);

test.skipIf(!isMacos)(
    'an existing macOS source reports the native runtime prerequisite without being treated as absent',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [POSIX_CANONICAL_SOURCE]: 'present\n' });
        using root = openRoot(sandbox.path, 'native');
        const path = join(sandbox.path, POSIX_CANONICAL_SOURCE);
        const failure: unknown = await Promise.resolve()
            .then(() => root.realPath(POSIX_CANONICAL_SOURCE))
            .catch((error: unknown) => error);
        expect(failure).toMatchObject({
            name: 'GspotError',
            code: 'filesystem',
            message: `The runtime cannot resolve this existing filesystem path: ${path}. Check runtime support for this path.`,
            cause: { code: 'ENOENT' },
        });
    },
);

test('a genuinely absent root retains its filesystem error rather than a runtime prerequisite', async () => {
    await using sandbox = await testdir();
    const failure: unknown = await Promise.resolve()
        .then(() => openRoot(join(sandbox.path, 'missing')))
        .catch((error: unknown) => error);
    expect(failure).toMatchObject({
        code: 'ENOENT',
    });
});
