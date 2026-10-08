import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { planReplacement } from '#cli/lifecycle/ownership/plans.ts';
import { planRestoration } from '#cli/lifecycle/ownership/restoration.ts';
import { lstat, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

if (isPosix) {
    test('lifecycle ownership: an exactly reproduced escaping link is refused before ownership or recovery changes', async () => {
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
            ).toThrow();
            expect(log.state.files.map((entry) => entry.path)).toStrictEqual([]);
            expect(await readlink(join(project, 'tool'))).toBe('../outside');
            expect(await readFile(join(directory.path, 'outside'), 'utf8')).toBe('authored');
            expect(
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: 'valid',
                        next: { bytes: Buffer.from('corrected input'), mode: 0o644 },
                        kind: 'tool_file',
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
                    planReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('installed\n'), mode: 0o644 },
                        kind: 'tool_file',
                        canReplace: true,
                    }),
                ),
            ).toBe('changed');
            await writeFile(join(directory.path, 'config.txt'), 'authored later\n');
            expect(
                applyPlan(
                    log,
                    planReplacement(log, {
                        path: 'config.txt',
                        next: { bytes: Buffer.from('upgrade\n'), mode: 0o644 },
                        kind: 'tool_file',
                    }),
                ),
            ).toBe('preserved');
            expect(applyPlan(log, planRestoration(log, 'config.txt'))).toBe('preserved');
            expect(await readFile(join(directory.path, 'config.txt'), 'utf8')).toBe('authored later\n');
            expect(applyPlan(log, planRestoration(log, '.gspot/unowned'))).toBe('preserved');
        }
    });
}
