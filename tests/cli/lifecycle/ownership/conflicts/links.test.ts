import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { planReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { lstat, symlink, readFile, readlink } from 'node:fs/promises';

test.skipIf(!isPosix)(
    'lifecycle ownership: an exactly reproduced escaping link is refused before ownership or recovery changes',
    async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'project/.keep': '', outside: 'authored' });
        const project = join(directory.path, 'project');
        await symlink('../outside', join(project, 'tool'));
        {
            using log = openOwnership(project);

            const attributes = await lstat(join(project, 'tool'));
            const mode = attributes.mode & 0o7777;
            expect(() =>
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: 'tool',
                        next: {
                            bytes: Buffer.from('../outside'),
                            mode,
                            isLink: true,
                        },
                        kind: 'tool_file',
                    }),
                ),
            ).toThrow('Unsafe lifecycle path: "../outside"');
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
            expect(await readlink(join(project, 'tool'))).toBe('../outside');
            expect(await readFile(join(directory.path, 'outside'), 'utf8')).toBe('authored');
        }
    },
);
