import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { linkSync, readFileSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { mutationPath, openConfinedRoot } from '#cli/lifecycle/confined.ts';

describe.skipIf(process.platform === 'win32')('confined lifecycle mutations', () => {
    test('replacements preserve expected bytes and modes and refuse subsequent edits', async () => {
        await using directory = await testdir();
        const root = openConfinedRoot(directory.path);
        try {
            const original = { bytes: Buffer.from([0, 255, 10]), mode: 0o640 };
            root.write('config/input', original, undefined);
            expect(root.read('config/input')).toEqual(original);
            const next = { bytes: Buffer.from('replacement\n'), mode: 0o444 };
            root.write('config/input', next, original);
            expect(root.read('config/input')).toEqual(next);
            expect(() => root.write('config/input', original, original)).toThrow('changed');
            expect(() => root.remove('config/input', original)).toThrow('changed');
            expect(root.read('config/input')).toEqual(next);
            root.remove('config/input', next);
            expect(root.read('config/input')).toBeUndefined();
        } finally {
            root.close();
        }
    });

    test.each(['portable', 'native'] as const)(
        '%s paths cannot use symlinks or hardlinks to change an external file',
        async (format) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'project/.keep': '', 'outside/sentinel': 'authored\n' });
            const outside = join(directory.path, 'outside');
            const project = join(directory.path, 'project');
            symlinkSync(outside, join(project, 'escape'));
            symlinkSync(join(outside, 'sentinel'), join(project, 'linked'));
            linkSync(join(outside, 'sentinel'), join(project, 'hardlinked'));
            const root = openConfinedRoot(project, format);
            try {
                for (const path of ['escape/sentinel', 'linked', 'hardlinked']) {
                    expect(() => root.write(path, { bytes: Buffer.from('lost'), mode: 0o600 }, undefined)).toThrow();
                    expect(() => root.remove(path, { bytes: Buffer.from('authored\n'), mode: 0o644 })).toThrow();
                    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('authored\n');
                }
                root.mkdir('.gspot/recovery', 0o700);
                expect(statSync(join(project, '.gspot/recovery')).mode & 0o777).toBe(0o700);
            } finally {
                root.close();
            }
        },
    );

    test('native snapshot names retain POSIX bytes while refusing traversal and private links', async () => {
        await using directory = await testdir();
        const root = openConfinedRoot(directory.path, 'native');
        const path = 'folder/a\n"é:?.txt';
        const original = { bytes: Buffer.from('inside'), mode: 0o640 };
        try {
            root.write(path, original, undefined);
            expect(root.read(path)).toEqual(original);
            expect(() => mutationPath(path)).toThrow('Unsafe lifecycle path');
            const link = { bytes: Buffer.from(path), mode: 0o777, isLink: true as const };
            root.write('linked', link, undefined);
            expect(root.readEntry('linked')).toEqual(link);
            for (const unsafe of ['../outside', '/outside', 'folder/../outside', 'nul\0suffix']) {
                expect(() => root.write(unsafe, original, undefined)).toThrow('Unsafe lifecycle path');
            }
            expect(() =>
                root.write('private-link', { ...link, bytes: Buffer.from('.gspot/ownership.json') }, undefined),
            ).toThrow('Lifecycle metadata');
        } finally {
            root.close();
        }
    });

    test('link publication refuses escaped, private, missing, and symlinked targets', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/target': 'inside', 'outside/sentinel': 'outside' });
        const project = join(directory.path, 'project');
        symlinkSync('../outside', join(project, 'escape'));
        symlinkSync('../outside/sentinel', join(project, 'escaped-file'));
        const root = openConfinedRoot(project);
        try {
            for (const target of [
                '../outside/sentinel',
                '/etc/passwd',
                'escape/sentinel',
                'escaped-file',
                'escape/../target',
                '.gspot/ownership.json',
                'missing',
                'target\u0000outside',
                'C:\\outside',
            ]) {
                expect(() =>
                    root.write('tool', { bytes: Buffer.from(target), mode: 0o777, isLink: true }, undefined),
                ).toThrow();
                expect(root.read('tool')).toBeUndefined();
                expect(readFileSync(join(directory.path, 'outside/sentinel'), 'utf8')).toBe('outside');
            }
            const next = { bytes: Buffer.from('target'), mode: 0o777, isLink: true as const };
            root.write('tool', next, undefined);
            expect(root.readEntry('tool')).toEqual(next);
            expect(readFileSync(join(project, 'tool'), 'utf8')).toBe('inside');
            root.remove('tool', next);
            expect(root.read('tool')).toBeUndefined();
            expect(readFileSync(join(project, 'target'), 'utf8')).toBe('inside');
        } finally {
            root.close();
        }
    });

    test('a parent replaced with a symlink cannot redirect a staged write', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'project/parent/sentinel': 'inside\n',
            'outside/sentinel': 'outside\n',
        });
        const implementation = fileURLToPath(new URL('../../../src/lifecycle/confined.ts', import.meta.url));
        const project = join(directory.path, 'project');
        const outside = join(directory.path, 'outside');
        const script = `
            import { mock } from 'bun:test';
            import * as fs from 'node:fs';
            const sync = fs.fsyncSync;
            let swapped = false;
            mock.module('node:fs', () => ({ ...fs, fsyncSync(fd) {
                sync(fd);
                if (!swapped && fs.fstatSync(fd).isFile()) {
                    fs.renameSync(${JSON.stringify(join(project, 'parent'))}, ${JSON.stringify(join(project, 'held'))});
                    fs.symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(join(project, 'parent'))});
                    swapped = true;
                }
            }}));
            const { openConfinedRoot } = await import(${JSON.stringify(implementation)});
            const files = openConfinedRoot(${JSON.stringify(project)});
            try {
                const original = files.read('parent/sentinel');
                files.write('parent/sentinel', {bytes: Buffer.from('replacement\\n'), mode: 420}, original);
            } finally { files.close(); }
        `;
        const result = Bun.spawnSync([process.execPath, '-e', script], { stdout: 'pipe', stderr: 'pipe' });
        expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
        expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('outside\n');
        expect(readFileSync(join(project, 'held/sentinel'), 'utf8')).toBe('replacement\n');
    });

    test('a second writer is refused until the first releases its lock', async () => {
        await using directory = await testdir();
        const first = openConfinedRoot(directory.path);
        const second = openConfinedRoot(directory.path);
        try {
            first.lock('.gspot/mutation.lock');
            expect(() => second.lock('.gspot/mutation.lock')).toThrow('Another lifecycle writer');
            rmSync(join(directory.path, '.gspot/mutation.lock'));
            expect(() => second.lock('.gspot/mutation.lock')).toThrow('Another lifecycle writer');
            first.close();
            expect(() => second.lock('.gspot/mutation.lock')).not.toThrow();
        } finally {
            first.close();
            second.close();
        }
    });
});

test('mutation paths reject portable escapes and preserve ordinary Unicode names', () => {
    for (const path of [
        '../outside',
        '/outside',
        'a/../b',
        'a//b',
        'a/./b',
        'C:relative',
        'C:/absolute',
        '\\\\server\\share',
        'a\\b',
        'nul.txt',
        'a/COM1',
        'a.',
        'a ',
        'a\0b',
        '',
    ]) {
        expect(() => mutationPath(path)).toThrow('Unsafe lifecycle path');
    }
    expect(mutationPath('documents/équipe 50%.md')).toEqual(['documents', 'équipe 50%.md']);
});
