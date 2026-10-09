import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { getCliSourcePath } from '#tests/harness/process.ts';
import { symlink, readFile, readlink } from 'node:fs/promises';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import { ownershipSchema } from '#cli/lifecycle/ownership/state/contracts.ts';

const implementation = getCliSourcePath('lifecycle/ownership/public.ts');
const boundary = getCliSourcePath('platform/root/public.ts');

test.skipIf(!isPosix).each(['before', 'after'] as const)(
    'lifecycle ownership: an interrupted link publication %s rename is kept only when it finished',
    async (point) => {
        await using directory = await testdir();
        await createFileTree(directory.path, { target: 'installed target', original: 'authored target' });
        await symlink('original', join(directory.path, 'tool'));
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
            const { openOwnership } = await import(${JSON.stringify(implementation)});
const {planReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/contracts.ts'))});
const {applyPlan}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/public.ts'))});
            using log = openOwnership(process.cwd());
            applyPlan(log, planReplacement(log,{path: 'tool', next: {bytes: Buffer.from('target'), mode: 511, isLink: true}, kind: 'tool_file', canReplace: true}));
        `;
        const child = runTestCommandBlocking([process.execPath, '-e', script], { cwd: directory.path });
        expect(child.code, child.stderr).toBe(73);
        {
            using log = openOwnership(directory.path);

            expect(await readlink(join(directory.path, 'tool'))).toBe(point === 'after' ? 'target' : 'original');
            expect(await readFile(join(directory.path, 'original'), 'utf8')).toBe('authored target');
            expect(await readFile(join(directory.path, 'target'), 'utf8')).toBe('installed target');
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual(point === 'after' ? ['tool'] : []);
        }
    },
);

test.skipIf(!isPosix).each(['before', 'after'] as const)(
    'lifecycle ownership: an interrupted replacement %s publication settles and releases its writer claim',
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
            const { openOwnership } = await import(${JSON.stringify(implementation)});
const {planReplacement}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/contracts.ts'))});
const {applyPlan}=await import(${JSON.stringify(getCliSourcePath('lifecycle/ownership/public.ts'))});
            using log = openOwnership(process.cwd());
            applyPlan(log, planReplacement(log,{path: 'config.txt', next: {bytes: Buffer.from('installed\n'), mode: 420}, kind: 'tool_file', canReplace: true}));
        `;
        const child = runTestCommandBlocking([process.execPath, '-e', script], { cwd: directory.path });
        expect(child.code, child.stdout + child.stderr).toBe(73);
        const pending = ownershipSchema.parse(
            JSON.parse(await readFile(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
        );
        expect(pending.pending?.[0]?.path).toBe('config.txt');
        {
            using log = openOwnership(directory.path);

            expect(log.state.files.map((entry) => entry.path)).toStrictEqual(point === 'after' ? ['config.txt'] : []);
            expect(await readFile(join(directory.path, 'config.txt'), 'utf8')).toBe(
                point === 'after' ? 'installed\n' : 'original\n',
            );
            const recovered = ownershipSchema.parse(
                JSON.parse(await readFile(join(directory.path, '.gspot/state/ownership.json'), 'utf8')),
            );
            expect(recovered.pending).toBeUndefined();
        }
    },
);
