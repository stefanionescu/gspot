import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { cliSource } from '#tests/support/cli/process.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { openOwner } from '#cli/lifecycle/ownership/owner.ts';
import { symlinkSync, readFileSync, readlinkSync } from 'node:fs';
import { ownershipSchema } from '#cli/lifecycle/ownership/schema.ts';

const implementation = cliSource('lifecycle/ownership/owner.ts');
const boundary = cliSource('platform/filesystem.ts');

if (onPosix) {
    test.each(['before', 'after'] as const)(
        'lifecycle ownership: an interrupted link publication %s rename is kept only when it finished',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { target: 'installed target', original: 'authored target' });
            symlinkSync('original', join(directory.path, 'tool'));
            const script = `
            import { mock } from 'bun:test';
            const boundary = await import(${JSON.stringify(boundary)});
            const open = boundary.openRoot;
            mock.module(${JSON.stringify(boundary)}, () => ({ ...boundary, openRoot(root) {
                const files = open(root);
                return { ...files, write(path, value, expected) {
                    if (path === 'tool' && ${JSON.stringify(point)} === 'before') process.exit(73);
                    files.write(path, value, expected);
                    if (path === 'tool' && ${JSON.stringify(point)} === 'after') process.exit(73);
                }};
            }}));
            const { openOwner } = await import(${JSON.stringify(implementation)});
            openOwner(process.cwd()).replace('tool', {bytes: Buffer.from('target'), mode: 511, isLink: true}, 'config', true);
        `;
            const child = Bun.spawnSync([process.execPath, '-e', script], {
                cwd: directory.path,
                stdout: 'pipe',
                stderr: 'pipe',
            });
            expect(child.exitCode, child.stderr.toString()).toBe(73);
            const owner = openOwner(directory.path);
            try {
                expect(readlinkSync(join(directory.path, 'tool'))).toBe(point === 'after' ? 'target' : 'original');
                expect(readFileSync(join(directory.path, 'original'), 'utf8')).toBe('authored target');
                expect(readFileSync(join(directory.path, 'target'), 'utf8')).toBe('installed target');
                expect(owner.paths()).toStrictEqual(point === 'after' ? ['tool'] : []);
            } finally {
                owner.close();
            }
        },
    );

    test.each(['before', 'after'] as const)(
        'lifecycle ownership: an interrupted replacement %s publication settles and releases its writer lock',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { 'config.txt': 'original\n' });
            const script = String.raw`
            import { mock } from 'bun:test';
            const boundary = await import(${JSON.stringify(boundary)});
            const open = boundary.openRoot;
            mock.module(${JSON.stringify(boundary)}, () => ({
                ...boundary,
                openRoot(root) {
                    const files = open(root);
                    return { ...files, write(path, value, expected) {
                        if (path === 'config.txt' && ${JSON.stringify(point)} === 'before') process.exit(73);
                        files.write(path, value, expected);
                        if (path === 'config.txt' && ${JSON.stringify(point)} === 'after') process.exit(73);
                    } };
                },
            }));
            const { openOwner } = await import(${JSON.stringify(implementation)});
            openOwner(process.cwd()).replace('config.txt', {bytes: Buffer.from('installed\n'), mode: 420}, 'config', true);
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
            const owner = openOwner(directory.path);
            try {
                expect(owner.paths()).toStrictEqual(point === 'after' ? ['config.txt'] : []);
                expect(readFileSync(join(directory.path, 'config.txt'), 'utf8')).toBe(
                    point === 'after' ? 'installed\n' : 'original\n',
                );
                const recovered = ownershipSchema.parse(
                    JSON.parse(readFileSync(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
                );
                expect(recovered.pending).toBeUndefined();
            } finally {
                owner.close();
            }
        },
    );
}
