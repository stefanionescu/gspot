import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { getCliSourcePath } from '#tests/harness/gspot.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { symlink, readFile, readlink } from 'node:fs/promises';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';

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
