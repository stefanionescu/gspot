import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { ownershipSchema } from '#cli/lifecycle/log.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';
import { installedOutputs } from '#cli/tools/installed-files.ts';
import { chmodSync, lstatSync, unlinkSync, symlinkSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';

test('installation publishes internal directory aliases as owned files without following external links', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(installation.path, { 'lib/package.py': 'value = 7\n' });
    await createFileTree(outside.path, { 'secret.py': 'external bytes' });
    symlinkSync('lib', join(installation.path, 'lib64'), 'dir');
    const owner = openOwner(repository.path);
    try {
        owner.installTree('python', installedOutputs(installation.path, 'python'));
        expect(owner.read('.gspot/.venv/lib64/package.py')?.bytes.toString()).toBe('value = 7\n');
        expect(lstatSync(join(repository.path, '.gspot/.venv/lib64')).isSymbolicLink()).toBe(false);
        owner.installTree('python', installedOutputs(installation.path, 'python'));
        expect(owner.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 7\n');
        symlinkSync(outside.path, join(installation.path, 'external'), 'dir');
        expect(() => {
            owner.installTree('python', installedOutputs(installation.path, 'python'));
        }).toThrow('Source link leaves the repository');
        expect(owner.read('.gspot/.venv/external/secret.py')).toBeUndefined();
        expect(readFileSync(join(outside.path, 'secret.py'), 'utf8')).toBe('external bytes');
    } finally {
        owner.close();
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
    symlinkSync('package.py', join(installation.path, 'lib/alias.py'), 'file');
    symlinkSync('../lib', join(installation.path, 'nested/library'), 'dir');
    const owner = openOwner(repository.path);
    try {
        owner.installTree('python', installedOutputs(installation.path, 'python'));
        expect(owner.read('.gspot/.venv/nested/library/alias.py')?.bytes.toString()).toBe('value = 9\n');
        expect(owner.read('.gspot/.venv/nested/library/__pycache__/package.pyc')).toBeUndefined();
        expect(readlinkSync(join(repository.path, '.gspot/.venv/lib/alias.py'))).toBe('package.py');
        symlinkSync('..', join(installation.path, 'lib/cycle'), 'dir');
        writeFileSync(join(installation.path, 'lib/package.py'), 'unpublished change');
        expect(() => {
            owner.installTree('python', installedOutputs(installation.path, 'python'));
        }).toThrow('Installed directory link forms a cycle');
        expect(owner.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 9\n');
    } finally {
        owner.close();
    }
});

test('installation refuses a linked output root before publication and accepts a real directory', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'package/file.js': 'external bytes' });
    symlinkSync(outside.path, join(installation.path, 'node_modules'), 'dir');
    const owner = openOwner(repository.path);
    try {
        expect(() => {
            owner.installTree('npm', installedOutputs(join(installation.path, 'node_modules'), 'npm'));
        }).toThrow('Unsafe lifecycle destination');
        expect(owner.read('.gspot/node_modules/package/file.js')).toBeUndefined();
        expect(readFileSync(join(outside.path, 'package/file.js'), 'utf8')).toBe('external bytes');
        unlinkSync(join(installation.path, 'node_modules'));
        await createFileTree(installation.path, { 'node_modules/package/file.js': 'installed bytes' });
        owner.installTree('npm', installedOutputs(join(installation.path, 'node_modules'), 'npm'));
        expect(owner.read('.gspot/node_modules/package/file.js')?.bytes.toString()).toBe('installed bytes');
    } finally {
        owner.close();
    }
});
if (onPosix) {
    test('lifecycle ownership: an exactly reproduced escaping link is refused before ownership or recovery changes', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', outside: 'authored' });
        const project = join(directory.path, 'project');
        symlinkSync('../outside', join(project, 'tool'));
        const owner = openOwner(project);
        try {
            expect(() =>
                owner.replace(
                    'tool',
                    {
                        bytes: Buffer.from('../outside'),
                        mode: lstatSync(join(project, 'tool')).mode & 0o7777,
                        isLink: true,
                    },
                    'config',
                ),
            ).toThrow();
            expect(owner.paths()).toStrictEqual([]);
            expect(readlinkSync(join(project, 'tool'))).toBe('../outside');
            expect(readFileSync(join(directory.path, 'outside'), 'utf8')).toBe('authored');
            expect(owner.replace('valid', { bytes: Buffer.from('corrected input'), mode: 0o644 }, 'config')).toBe(
                'changed',
            );
        } finally {
            owner.close();
        }
    });

    test('lifecycle ownership: later edits survive both apply and uninstall, with the original recovery bytes retained', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored original\n' });
        const owner = openOwner(directory.path);
        try {
            expect(
                owner.replace('config.txt', { bytes: Buffer.from('installed\n'), mode: 0o644 }, 'config', true),
            ).toBe('changed');
            writeFileSync(join(directory.path, 'config.txt'), 'authored later\n');
            expect(owner.replace('config.txt', { bytes: Buffer.from('upgrade\n'), mode: 0o644 }, 'config')).toBe(
                'preserved',
            );
            expect(owner.restore('config.txt')).toBe('preserved');
            expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('authored later\n');
            const state = ownershipSchema.parse(
                JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
            );
            expect(readFileSync(join(directory.path, state.files[0]!.original!.backup), 'utf8')).toBe(
                'authored original\n',
            );
            expect(owner.restore('.gspot/unowned')).toBe('preserved');
        } finally {
            owner.close();
        }
    });

    test.each(['bytes', 'mode', 'removed'])(
        'lifecycle ownership: stale replace %s refuses replacement and retirement, then a fresh read succeeds',
        async (change) => {
            await using directory = await testdir();
            const path = join(directory.path, 'authored.json');
            writeFileSync(path, '{"semi":false}\n', { mode: 0o640 });
            const owner = openOwner(directory.path);
            try {
                const read = owner.read('authored.json')!;
                if (change === 'bytes') writeFileSync(path, '{"semi":true}\n');
                if (change === 'mode') chmodSync(path, 0o600);
                if (change === 'removed') unlinkSync(path);
                const edited = owner.read('authored.json');
                expect(() =>
                    owner.replace('authored.json', { bytes: Buffer.from('{}\n'), mode: 0o444 }, 'config', true, read),
                ).toThrow('changed after replace was planned');
                expect(() => owner.proposeRetirement('authored.json', read)).toThrow(
                    'changed after replace was planned',
                );
                expect(owner.read('authored.json')).toStrictEqual(edited);
                if (change === 'removed') writeFileSync(path, '{"semi":true}\n', { mode: 0o600 });
                const refreshed = owner.read('authored.json')!;
                expect(owner.applyPlan(owner.proposeRetirement('authored.json', refreshed))).toBe('changed');
                expect(owner.restore('authored.json')).toBe('changed');
                expect(owner.read('authored.json')).toStrictEqual(refreshed);
            } finally {
                owner.close();
            }
        },
    );
}
