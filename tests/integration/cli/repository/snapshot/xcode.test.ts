import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/harness/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { scopeInput } from '#tests/harness/cli/input.ts';
import { onPosix } from '#tests/harness/cli/platforms.ts';
import { containing } from '#tests/harness/expectations.ts';
import { projectSymlinks } from '#cli/checks/tool/xcode/project.ts';
import { unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';

// Windows file names cannot hold a newline or a quote.
if (onPosix)
    test('Xcode reports exact staged symlink targets before the first commit and clears corrected files', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['xcode']),
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
        const spec = selected.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'xcode/symlinks')!;
        const input = scopeInput(session, spec);
        expect(await projectSymlinks(input)).toStrictEqual([
            {
                check: 'xcode/symlinks',
                file: path,
                line: 1,
                rule: 'symlink',
                fixable: false,
                message: 'A symlink to target.swift; Xcode and the checks each follow it their own way.',
            },
        ]);
        unlinkSync(join(sandbox.path, path));
        writeFileSync(join(sandbox.path, path), 'let value = 1\n');
        gitOutput(sandbox.path, ['add', '.']);
        expect(await projectSymlinks(input)).toStrictEqual([
            containing({
                file: path,
                message: 'A symlink to target.swift; Xcode and the checks each follow it their own way.',
            }),
        ]);
        input.reads = { root: sandbox.path, sources: new Map() };
        expect(await projectSymlinks(input)).toStrictEqual([]);
        const index = readFileSync(join(sandbox.path, '.git', 'index'));
        writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
        input.reads = { root: sandbox.path, sources: new Map() };
        await rejects(projectSymlinks(input), { message: /Cannot read the Git index/u });
        writeFileSync(join(sandbox.path, '.git', 'index'), index);
        input.reads = { root: sandbox.path, sources: new Map() };
        expect(await projectSymlinks(input)).toStrictEqual([]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe('let value = 1\n');
    });
