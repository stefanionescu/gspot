import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { interruptOwner } from '#tests/harness/process.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { symlink, readFile, readlink } from 'node:fs/promises';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { INTERRUPTION_EXIT_CODE } from '#tests/config/harness/process.ts';

describe('lifecycle ownership', () => {
    test.skipIf(!isPosix).each(['before', 'after'] as const)(
        'an interrupted link publication %s rename is kept only when it finished',
        async (point) => {
            await using directory = await testdir();
            await createFileTree(directory.path, { target: 'installed target', original: 'authored target' });
            await symlink('original', join(directory.path, 'tool'));
            const child = await interruptOwner(
                directory.path,
                { operation: 'write', path: 'tool', point },
                `applyPlans(log, [planReplacement(log,{path: 'tool', next: {bytes: Buffer.from('target'), mode: 0o777, isLink: true}, kind: 'tool_file', canReplace: true})]);`,
            );
            expect(child.code, child.stderr).toBe(INTERRUPTION_EXIT_CODE);
            {
                using log = openOwnership(directory.path);

                expect(await readlink(join(directory.path, 'tool'))).toBe(point === 'after' ? 'target' : 'original');
                expect(await readFile(join(directory.path, 'original'), 'utf8')).toBe('authored target');
                expect(await readFile(join(directory.path, 'target'), 'utf8')).toBe('installed target');
                expect(log.state.files.map((entry) => entry.path)).toStrictEqual(point === 'after' ? ['tool'] : []);
            }
        },
    );
});
