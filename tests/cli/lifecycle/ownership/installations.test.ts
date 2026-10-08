import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { pathExists } from '#tests/harness/preservation.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { getOwnership, openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { SWAP_CASES } from '#tests/config/cli/lifecycle/ownership/installations.ts';
import { rm, lstat, unlink, symlink, readFile, readlink, writeFile } from 'node:fs/promises';
import { installTree, readInstalledTree, deleteInstallation } from '#cli/lifecycle/ownership/state/public.ts';

test('an installation is one record, and removing it deletes the folder', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    {
        using log = openOwnership(directory.path);

        installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
        expect(getOwnership(directory.path)).toMatchObject({ files: [], installed: ['npm'] });
        deleteInstallation(log, 'npm');
        expect(await pathExists(join(directory.path, '.gspot/node_modules'))).toBe(false);
        expect(getOwnership(directory.path).installed).toBeUndefined();
    }
});

test('an installation refuses a folder gspot did not install and leaves it as it was', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(directory.path, { '.gspot/node_modules/authored/index.js': 'authored\n' });
    await createFileTree(staged.path, { 'tool/index.js': 'export {};\n' });
    {
        using log = openOwnership(directory.path);

        expect(() => {
            installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
        }).toThrow('.gspot/node_modules exists and gspot did not create it. Move it aside, then run gspot install.');
        expect(await pathExists(join(directory.path, '.gspot/node_modules/authored/index.js'))).toBe(true);
        expect(getOwnership(directory.path).installing).toBeUndefined();
    }
});

test.each(SWAP_CASES)('an interrupted swap retains the correct folder when $name', async ({ files, kept }) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        '.gspot/state/ownership.json': `${JSON.stringify({ version: 1, files: [], installing: ['npm'] })}\n`,
        '.gspot/node_modules.previous/tool/index.js': 'previous\n',
        '.gspot/node_modules.next/tool/index.js': 'partial\n',
        ...files,
    });
    openOwnership(directory.path)[Symbol.dispose]();
    expect(await readFile(join(directory.path, '.gspot/node_modules/tool/index.js'), 'utf8')).toBe(kept);
    expect(await pathExists(join(directory.path, '.gspot/node_modules.previous'))).toBe(false);
    expect(await pathExists(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
    expect(getOwnership(directory.path).installing).toStrictEqual(['npm']);
});

test('an install killed after its swap and before its record is replaced by the next install', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    await createFileTree(directory.path, {
        '.gspot/state/ownership.json': `${JSON.stringify({ version: 1, files: [], installing: ['npm'] })}\n`,
        '.gspot/node_modules/tool/index.js': 'swapped\n',
    });
    await createFileTree(staged.path, { 'tool/index.js': 'reinstalled\n' });
    {
        using log = openOwnership(directory.path);

        installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
    }
    expect(await readFile(join(directory.path, '.gspot/node_modules/tool/index.js'), 'utf8')).toBe('reinstalled\n');
    expect(getOwnership(directory.path)).toMatchObject({ installed: ['npm'] });
    expect(getOwnership(directory.path).installing).toBeUndefined();
});

test('installation publishes internal directory aliases as owned files without following external links', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(installation.path, { 'lib/package.py': 'value = 7\n' });
    await createFileTree(outside.path, { 'secret.py': 'external bytes' });
    await symlink('lib', join(installation.path, 'lib64'), 'dir');
    {
        using log = openOwnership(repository.path);

        installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        expect(log.files.read('.gspot/.venv/lib64/package.py')?.bytes.toString()).toBe('value = 7\n');
        const attributes = await lstat(join(repository.path, '.gspot/.venv/lib64'));
        expect(attributes.isSymbolicLink()).toBe(false);
        installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        expect(log.files.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 7\n');
        await symlink(outside.path, join(installation.path, 'external'), 'dir');
        expect(() => {
            installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        }).toThrow('Source link leaves the repository');
        expect(log.files.read('.gspot/.venv/external/secret.py')).toBeUndefined();
        expect(await readFile(join(outside.path, 'secret.py'), 'utf8')).toBe('external bytes');
    }
});

test('installation resolves nested directory aliases and rejects cycles before publication', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await createFileTree(installation.path, {
        'lib/package.py': 'value = 9\n',
        'lib/__pycache__/package.pyc': 'temporary cache',
        'nested/.keep': '',
    });
    await symlink('package.py', join(installation.path, 'lib/alias.py'), 'file');
    await symlink('../lib', join(installation.path, 'nested/library'), 'dir');
    {
        using log = openOwnership(repository.path);

        installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        expect(log.files.read('.gspot/.venv/nested/library/alias.py')?.bytes.toString()).toBe('value = 9\n');
        expect(log.files.read('.gspot/.venv/nested/library/__pycache__/package.pyc')).toBeUndefined();
        expect(await readlink(join(repository.path, '.gspot/.venv/lib/alias.py'))).toBe('package.py');
        await symlink('..', join(installation.path, 'lib/cycle'), 'dir');
        await writeFile(join(installation.path, 'lib/package.py'), 'unpublished change');
        expect(() => {
            installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        }).toThrow('Installed directory link forms a cycle');
        expect(log.files.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 9\n');
    }
});

test('installation refuses a linked output root before publication and accepts a real directory', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'package/file.js': 'external bytes' });
    await symlink(outside.path, join(installation.path, 'node_modules'), 'dir');
    {
        using log = openOwnership(repository.path);

        expect(() => {
            installTree(log, 'npm', readInstalledTree(join(installation.path, 'node_modules'), 'npm'));
        }).toThrow('Unsafe lifecycle destination');
        expect(log.files.read('.gspot/node_modules/package/file.js')).toBeUndefined();
        expect(await readFile(join(outside.path, 'package/file.js'), 'utf8')).toBe('external bytes');
        await unlink(join(installation.path, 'node_modules'));
        await createFileTree(installation.path, { 'node_modules/package/file.js': 'installed bytes' });
        installTree(log, 'npm', readInstalledTree(join(installation.path, 'node_modules'), 'npm'));
        expect(log.files.read('.gspot/node_modules/package/file.js')?.bytes.toString()).toBe('installed bytes');
    }
});

test('a Python installation replaces the whole environment, runtime caches included, as one record', async () => {
    await using directory = await testdir();
    await using staged = await testdir();
    const cache = '.gspot/.venv/lib/__pycache__';
    await createFileTree(staged.path, {
        'lib/package.py': 'value = 2\n',
        'lib/package.pyc': 'packaged legacy bytecode',
        'lib/__pycache__/new.pyc': 'temporary new bytecode',
    });
    {
        using log = openOwnership(directory.path);

        installTree(log, 'python', readInstalledTree(staged.path, 'python'));
        await createFileTree(directory.path, { [`${cache}/unowned.pyc`]: 'runtime bytes' });
        installTree(log, 'python', readInstalledTree(staged.path, 'python'));
        expect(log.files.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 2\n');
        expect(log.files.read('.gspot/.venv/lib/package.pyc')?.bytes.toString()).toBe('packaged legacy bytecode');
        // Runtime caches leave with the old environment; the staged caches are never published.
        expect(await pathExists(join(directory.path, `${cache}/unowned.pyc`))).toBe(false);
        expect(await pathExists(join(directory.path, `${cache}/new.pyc`))).toBe(false);
        expect(getOwnership(directory.path)).toStrictEqual({ version: 1, files: [], installed: ['python'] });
    }
});

describe.if(isPosix)('lifecycle ownership', () => {
    test('an installation replaces the folder it owns whole, edits and obsolete files included', async () => {
        await using directory = await testdir();
        await using staged = await testdir();
        await createFileTree(staged.path, { 'package/bin/tool': 'new executable', '.bin/.keep': '', obsolete: 'old' });
        await symlink('../package/bin/tool', join(staged.path, '.bin/tool'));
        {
            using log = openOwnership(directory.path);

            installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
            await writeFile(join(directory.path, '.gspot/node_modules/obsolete'), 'hand edit');
            await rm(join(staged.path, 'obsolete'));
            installTree(log, 'npm', readInstalledTree(staged.path, 'npm'));
            expect(await readFile(join(directory.path, '.gspot/node_modules/.bin/tool'), 'utf8')).toBe(
                'new executable',
            );
            expect(await pathExists(join(directory.path, '.gspot/node_modules/obsolete'))).toBe(false);
            expect(await pathExists(join(directory.path, '.gspot/node_modules.next'))).toBe(false);
            expect(await pathExists(join(directory.path, '.gspot/node_modules.previous'))).toBe(false);
        }
    });
});
