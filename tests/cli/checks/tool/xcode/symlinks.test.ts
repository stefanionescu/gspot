import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { rejection, containing } from '#tests/harness/expectations.ts';
import { unlink, symlink, readFile, writeFile } from 'node:fs/promises';

// Windows file names cannot hold a newline or a quote.
test.skipIf(!isPosix)(
    'Xcode reports exact staged symlink targets before the first commit and clears corrected files',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['xcode']),
            'App.xcodeproj/project.pbxproj': '{}\n',
            'target.swift': 'let value = 1\n',
        });
        const path = 'link\n"é.swift';
        await symlink('target.swift', join(sandbox.path, path));
        gitOutput(sandbox.path, ['init']);
        gitOutput(sandbox.path, ['add', '.']);
        await unlink(join(sandbox.path, path));
        await symlink('working-tree.swift', join(sandbox.path, path));
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'xcode/symlinks');
        expect(await BUILT_IN_CHECKS['xcode/symlinks'].input(input)).toStrictEqual([
            containing({ check: 'xcode/symlinks', file: path, line: 1, rule: 'symlink', fixable: false }),
        ]);
        await unlink(join(sandbox.path, path));
        await writeFile(join(sandbox.path, path), 'let value = 1\n');
        gitOutput(sandbox.path, ['add', '.']);
        const corrected = buildCheckInput(await openSession(sandbox.path), 'xcode/symlinks');
        expect(await BUILT_IN_CHECKS['xcode/symlinks'].input(corrected)).toStrictEqual([]);
        const index = await readFile(join(sandbox.path, '.git', 'index'));
        await writeFile(join(sandbox.path, '.git', 'index'), 'broken');
        expect(await rejection(openSession(sandbox.path))).toContain('Git ls-files failed');
        await writeFile(join(sandbox.path, '.git', 'index'), index);
        const recovered = buildCheckInput(await openSession(sandbox.path), 'xcode/symlinks');
        expect(await BUILT_IN_CHECKS['xcode/symlinks'].input(recovered)).toStrictEqual([]);
    },
);
