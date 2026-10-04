import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { readInstalledTree } from '#cli/tools/installed-files.ts';
import { installTree } from '#cli/lifecycle/ownership/installations.ts';
import { proposeRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { proposeRetirement, proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { chmodSync, lstatSync, unlinkSync, symlinkSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs';

test('installation publishes internal directory aliases as owned files without following external links', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(installation.path, { 'lib/package.py': 'value = 7\n' });
    await createFileTree(outside.path, { 'secret.py': 'external bytes' });
    symlinkSync('lib', join(installation.path, 'lib64'), 'dir');
    {
        using log = openOwnership(repository.path);

        installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        expect(log.files.read('.gspot/.venv/lib64/package.py')?.bytes.toString()).toBe('value = 7\n');
        expect(lstatSync(join(repository.path, '.gspot/.venv/lib64')).isSymbolicLink()).toBe(false);
        installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        expect(log.files.read('.gspot/.venv/lib/package.py')?.bytes.toString()).toBe('value = 7\n');
        symlinkSync(outside.path, join(installation.path, 'external'), 'dir');
        expect(() => {
            installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        }).toThrow('Source link leaves the repository');
        expect(log.files.read('.gspot/.venv/external/secret.py')).toBeUndefined();
        expect(readFileSync(join(outside.path, 'secret.py'), 'utf8')).toBe('external bytes');
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
    {
        using log = openOwnership(repository.path);

        installTree(log, 'python', readInstalledTree(installation.path, 'python'));
        expect(log.files.read('.gspot/.venv/nested/library/alias.py')?.bytes.toString()).toBe('value = 9\n');
        expect(log.files.read('.gspot/.venv/nested/library/__pycache__/package.pyc')).toBeUndefined();
        expect(readlinkSync(join(repository.path, '.gspot/.venv/lib/alias.py'))).toBe('package.py');
        symlinkSync('..', join(installation.path, 'lib/cycle'), 'dir');
        writeFileSync(join(installation.path, 'lib/package.py'), 'unpublished change');
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
    symlinkSync(outside.path, join(installation.path, 'node_modules'), 'dir');
    {
        using log = openOwnership(repository.path);

        expect(() => {
            installTree(log, 'npm', readInstalledTree(join(installation.path, 'node_modules'), 'npm'));
        }).toThrow('Unsafe lifecycle destination');
        expect(log.files.read('.gspot/node_modules/package/file.js')).toBeUndefined();
        expect(readFileSync(join(outside.path, 'package/file.js'), 'utf8')).toBe('external bytes');
        unlinkSync(join(installation.path, 'node_modules'));
        await createFileTree(installation.path, { 'node_modules/package/file.js': 'installed bytes' });
        installTree(log, 'npm', readInstalledTree(join(installation.path, 'node_modules'), 'npm'));
        expect(log.files.read('.gspot/node_modules/package/file.js')?.bytes.toString()).toBe('installed bytes');
    }
});
if (isPosix) {
    test('lifecycle ownership: an exactly reproduced escaping link is refused before ownership or recovery changes', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', outside: 'authored' });
        const project = join(directory.path, 'project');
        symlinkSync('../outside', join(project, 'tool'));
        {
            using log = openOwnership(project);

            expect(() =>
                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: 'tool',
                        next: {
                            bytes: Buffer.from('../outside'),
                            mode: lstatSync(join(project, 'tool')).mode & 0o7777,
                            isLink: true,
                        },
                        kind: 'config',
                    }),
                ),
            ).toThrow();
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
            expect(readlinkSync(join(project, 'tool'))).toBe('../outside');
            expect(readFileSync(join(directory.path, 'outside'), 'utf8')).toBe('authored');
            expect(
                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: 'valid',
                        next: { bytes: Buffer.from('corrected input'), mode: 0o644 },
                        kind: 'config',
                    }),
                ),
            ).toBe('changed');
        }
    });

    test('lifecycle ownership: later edits survive both apply and a prune', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'config.txt': 'authored original\n' });
        {
            using log = openOwnership(directory.path);

            expect(
                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                        kind: 'config',
                        canReplace: true,
                    }),
                ),
            ).toBe('changed');
            writeFileSync(join(directory.path, 'config.txt'), 'authored later\n');
            expect(
                applyPlan(
                    log,
                    proposeReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('upgrade\n'), mode: 0o644 },
                        kind: 'config',
                    }),
                ),
            ).toBe('preserved');
            expect(applyPlan(log, proposeRestoration(log, 'config.txt'))).toBe('preserved');
            expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('authored later\n');
            expect(applyPlan(log, proposeRestoration(log, '.gspot/unowned'))).toBe('preserved');
        }
    });

    test.each(['bytes', 'mode', 'removed'])(
        'lifecycle ownership: stale replace %s refuses replacement and retirement, then a fresh read succeeds',
        async (change) => {
            await using directory = await testdir();
            const path = join(directory.path, 'authored.json');
            writeFileSync(path, '{"semi":false}\n', { mode: 0o640 });
            {
                using log = openOwnership(directory.path);

                const read = log.files.read('authored.json')!;
                if (change === 'bytes') writeFileSync(path, '{"semi":true}\n');
                if (change === 'mode') chmodSync(path, 0o600);
                if (change === 'removed') unlinkSync(path);
                const edited = log.files.read('authored.json');
                expect(() =>
                    applyPlan(
                        log,
                        proposeReplacement(log, {
                            path: 'authored.json',
                            next: { bytes: Buffer.from('{}\n'), mode: 0o444 },
                            kind: 'config',
                            canReplace: true,
                            expected: read,
                        }),
                    ),
                ).toThrow('authored.json changed after gspot read it. Run the command again.');
                expect(() => proposeRetirement(log, 'authored.json', read)).toThrow(
                    'authored.json changed after gspot read it. Run the command again.',
                );
                expect(log.files.read('authored.json')).toStrictEqual(edited);
                if (change === 'removed') writeFileSync(path, '{"semi":true}\n', { mode: 0o600 });
                const refreshed = log.files.read('authored.json')!;
                expect(applyPlan(log, proposeRetirement(log, 'authored.json', refreshed))).toBe('changed');
                expect(log.files.read('authored.json')).toBeUndefined();
            }
        },
    );
}
