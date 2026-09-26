import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { cliSource } from '#tests/support/cli/sources.ts';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { openLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { readFileSync, readlinkSync, symlinkSync } from 'node:fs';

const implementation = cliSource('lifecycle/ownership.ts');
const boundary = cliSource('platform/filesystem.ts');

describe.skipIf(process.platform === 'win32')('lifecycle ownership', () => {
    test.each(['before', 'after'] as const)(
        'interrupted link publication %s rename recovers without losing the original',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { target: 'installed target', original: 'authored target' });
            symlinkSync('original', join(directory.path, 'tool'));
            const script = `
            import { mock } from 'bun:test';
            const boundary = await import(${JSON.stringify(boundary)});
            const open = boundary.openConfinedRoot;
            mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openConfinedRoot(root) {
                const files = open(root);
                return { ...files, write(path, value, expected) {
                    if (path === 'tool' && ${JSON.stringify(point)} === 'before') process.exit(73);
                    files.write(path, value, expected);
                    if (path === 'tool' && ${JSON.stringify(point)} === 'after') process.exit(73);
                }};
            }}));
            const { openLifecycleOwner } = await import(${JSON.stringify(implementation)});
            openLifecycleOwner(process.cwd()).replace('tool', {bytes: Buffer.from('target'), mode: 511, isLink: true}, 'config', true);
        `;
            const child = Bun.spawnSync([process.execPath, '-e', script], {
                cwd: directory.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(child.exitCode, child.stderr.toString()).toBe(73);
            const owner = openLifecycleOwner(directory.path);
            try {
                if (point === 'after') expect(owner.restore('tool')).toBe('changed');
                expect(readlinkSync(join(directory.path, 'tool'))).toBe('original');
                expect(readFileSync(join(directory.path, 'original'), 'utf8')).toBe('authored target');
                expect(readFileSync(join(directory.path, 'target'), 'utf8')).toBe('installed target');
                expect(owner.paths()).toStrictEqual([]);
            } finally {
                owner.close();
            }
        },
    );

    test('unavailable recovery refuses takeover before modifying the original', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'config.txt': 'original\n',
            '.gspot/state/recovery': 'authored obstruction\n',
        });
        const owner = openLifecycleOwner(directory.path);
        try {
            expect(() =>
                owner.replace('config.txt', { bytes: Buffer.from('replacement'), mode: 0o644 }, 'config', true),
            ).toThrow();
            expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('original\n');
            expect(readFileSync(join(directory.path, '.gspot/state/recovery'), 'utf8')).toBe('authored obstruction\n');
        } finally {
            owner.close();
        }
    });

    test.each(['before', 'after'] as const)(
        'an interrupted replacement %s publication recovers and releases its writer lock',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'config.txt': 'original\n' });
            const script = String.raw`
            import { mock } from 'bun:test';
            const boundary = await import(${JSON.stringify(boundary)});
            const open = boundary.openConfinedRoot;
            mock.module(${JSON.stringify(boundary)}, () => ({
                ...boundary,
                openConfinedRoot(root) {
                    const files = open(root);
                    return { ...files, write(path, value, expected) {
                        if (path === 'config.txt' && ${JSON.stringify(point)} === 'before') process.exit(73);
                        files.write(path, value, expected);
                        if (path === 'config.txt' && ${JSON.stringify(point)} === 'after') process.exit(73);
                    } };
                },
            }));
            const { openLifecycleOwner } = await import(${JSON.stringify(implementation)});
            openLifecycleOwner(process.cwd()).replace('config.txt', {bytes: Buffer.from('installed\n'), mode: 420}, 'config', true);
        `;
            const child = Bun.spawnSync([process.execPath, '-e', script], {
                cwd: directory.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(73);
            const pending = ownershipSchema.parse(
                JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
            );
            expect(pending.pending?.[0]?.path).toBe('config.txt');
            const owner = openLifecycleOwner(directory.path);
            try {
                if (point === 'after') {
                    expect(owner.paths()).toStrictEqual(['config.txt']);
                    expect(owner.restore('config.txt')).toBe('changed');
                } else expect(owner.paths()).toStrictEqual([]);
                expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe('original\n');
                const recovered = ownershipSchema.parse(
                    JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
                );
                expect(recovered.pending).toBeUndefined();
            } finally {
                owner.close();
            }
        },
    );
});
