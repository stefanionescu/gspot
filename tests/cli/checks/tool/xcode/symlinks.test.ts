import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
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
        const spec = selected.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'xcode/symlinks')!;
        const input = buildEngineInput(session, spec.name);
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
        input.reads = { root: sandbox.path, sources: new Map(), memo: new Map() };
        expect(await symlinks(input)).toStrictEqual([]);
        const index = readFileSync(join(sandbox.path, '.git', 'index'));
        writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
        input.reads = { root: sandbox.path, sources: new Map(), memo: new Map() };
        await rejects(symlinks(input), { message: /Git could not read the entries of this revision/u });
        writeFileSync(join(sandbox.path, '.git', 'index'), index);
        input.reads = { root: sandbox.path, sources: new Map(), memo: new Map() };
        expect(await symlinks(input)).toStrictEqual([]);
        expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe('let value = 1\n');
    },
);
