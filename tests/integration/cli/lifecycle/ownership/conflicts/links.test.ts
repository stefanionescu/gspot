import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { publishInstalledFiles } from '#cli/tools/installed-files.ts';
import { chmodSync, lstatSync, readFileSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';

test('installation refuses a linked output root before publication and accepts a real directory', async () => {
    await using repository = await testdir();
    await using installation = await testdir();
    await using outside = await testdir();
    await createFileTree(outside.path, { 'package/file.js': 'external bytes' });
    symlinkSync(outside.path, join(installation.path, 'node_modules'), 'dir');
    const owner = openLifecycleOwner(repository.path);
    try {
        expect(() => {
            publishInstalledFiles(owner, join(installation.path, 'node_modules'), 'npm');
        }).toThrow('Unsafe lifecycle destination');
        expect(owner.read('.gspot/node_modules/package/file.js')).toBeUndefined();
        expect(readFileSync(join(outside.path, 'package/file.js'), 'utf8')).toBe('external bytes');
        unlinkSync(join(installation.path, 'node_modules'));
        await createFileTree(installation.path, { 'node_modules/package/file.js': 'installed bytes' });
        publishInstalledFiles(owner, join(installation.path, 'node_modules'), 'npm');
        expect(owner.read('.gspot/node_modules/package/file.js')?.bytes.toString()).toBe('installed bytes');
    } finally {
        owner.close();
    }
});
if (process.platform !== 'win32')
    describe('lifecycle ownership', () => {
        test('an exactly reproduced escaping link is refused before ownership or recovery changes', async () => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'project/.keep': '', outside: 'authored' });
            const project = join(directory.path, 'project');
            symlinkSync('../outside', join(project, 'tool'));
            const owner = openLifecycleOwner(project);
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

        test('later edits survive both apply and uninstall, with the original recovery bytes retained', async () => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'config.txt': 'authored original\n' });
            const owner = openLifecycleOwner(directory.path);
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
            'stale takeover %s refuses replacement and retirement, then a fresh observation succeeds',
            async (change) => {
                await using directory = await testdir();
                const path = join(directory.path, 'authored.json');
                writeFileSync(path, '{"semi":false}\n', { mode: 0o640 });
                const owner = openLifecycleOwner(directory.path);
                try {
                    const observed = owner.read('authored.json')!;
                    if (change === 'bytes') writeFileSync(path, '{"semi":true}\n');
                    if (change === 'mode') chmodSync(path, 0o600);
                    if (change === 'removed') unlinkSync(path);
                    const edited = owner.read('authored.json');
                    expect(() =>
                        owner.replace(
                            'authored.json',
                            { bytes: Buffer.from('{}\n'), mode: 0o444 },
                            'config',
                            true,
                            observed,
                        ),
                    ).toThrow('changed after takeover was planned');
                    expect(() => owner.proposeRetirement('authored.json', observed)).toThrow(
                        'changed after takeover was planned',
                    );
                    expect(owner.read('authored.json')).toStrictEqual(edited);
                    if (change === 'removed') writeFileSync(path, '{"semi":true}\n', { mode: 0o600 });
                    const refreshed = owner.read('authored.json')!;
                    expect(owner.applyProposal(owner.proposeRetirement('authored.json', refreshed))).toBe('changed');
                    expect(owner.restore('authored.json')).toBe('changed');
                    expect(owner.read('authored.json')).toStrictEqual(refreshed);
                } finally {
                    owner.close();
                }
            },
        );
    });
