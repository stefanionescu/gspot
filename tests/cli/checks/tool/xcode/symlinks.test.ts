import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { symlinks } from '#cli/checks/tool/xcode/project.ts';
import { unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

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
        symlinkSync('target.swift', join(sandbox.path, path));
        gitOutput(sandbox.path, ['init']);
        gitOutput(sandbox.path, ['add', '.']);
        unlinkSync(join(sandbox.path, path));
        symlinkSync('working-tree.swift', join(sandbox.path, path));
        const session = await openSession(sandbox.path);
        const selected = session.scopes[0]!;
        const check = selected.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'xcode/symlinks')!;
        const input = buildCheckInput(session, check.name);
        expect(await symlinks(input)).toStrictEqual([
            containing({ check: 'xcode/symlinks', file: path, line: 1, rule: 'symlink', fixable: false }),
        ]);
        unlinkSync(join(sandbox.path, path));
        writeFileSync(join(sandbox.path, path), 'let value = 1\n');
        gitOutput(sandbox.path, ['add', '.']);
        expect(await symlinks(input)).toStrictEqual([
            containing({
                file: path,
                rule: 'symlink',
            }),
        ]);
        const corrected = buildCheckInput(await openSession(sandbox.path), check.name);
        expect(await symlinks(corrected)).toStrictEqual([]);
        const index = readFileSync(join(sandbox.path, '.git', 'index'));
        writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
        await rejects(openSession(sandbox.path), { message: /Git ls-files failed/u });
        writeFileSync(join(sandbox.path, '.git', 'index'), index);
        const recovered = buildCheckInput(await openSession(sandbox.path), check.name);
        expect(await symlinks(recovered)).toStrictEqual([]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe('let value = 1\n');
    },
);
