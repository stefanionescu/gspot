import { rejects } from 'node:assert/strict';
import { join } from 'node:path';
import { symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { committedEntries, gitBlobs, gitEntries, withRevisionSnapshot } from '#cli/repository/snapshot.ts';
import { openSession } from '#cli/run/session.ts';
import { orphanSources, projectSymlinks } from '#cli/checks/xcode/project.ts';

function git(root: string, args: string[]): string {
    const result = runBlocking(['git', ...args], { cwd: root });
    expect(result.code).toBe(0);
    return result.stdout.trim();
}

test('unborn history is empty and committed blobs retain unusual filenames and bytes', async () => {
    await using sandbox = await testdir();
    git(sandbox.path, ['init']);
    expect(await committedEntries(sandbox.path)).toEqual([]);
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    git(sandbox.path, ['add', '.']);
    git(sandbox.path, ['-c', 'user.name=Example', '-c', 'user.email=example@example.com', 'commit', '-m', 'Fixture']);
    const entries = await committedEntries(sandbox.path);
    expect(entries.map((entry) => entry.path)).toEqual([path]);
    const blobs = await gitBlobs(
        sandbox.path,
        entries.map((entry) => entry.object),
    );
    expect(blobs.get(entries[0]!.object)?.toString()).toBe('select 1;\n');
    await withRevisionSnapshot(sandbox.path, { kind: 'index' }, async (snapshot) => {
        expect(await Bun.file(join(snapshot, path)).text()).toBe('select 1;\n');
    });
    writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
    await rejects(gitEntries(sandbox.path, { kind: 'index' }), { message: /Cannot read the Git index/u });
    writeFileSync(join(sandbox.path, '.git', 'HEAD'), 'broken');
    await rejects(committedEntries(sandbox.path));
});

test('Xcode reports exact staged symlink targets before the first commit and clears corrected files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["xcode"]\n',
        'App.xcodeproj/project.pbxproj': '{}\n',
        'target.swift': 'let value = 1\n',
    });
    const path = 'link\n"é.swift';
    symlinkSync('target.swift', join(sandbox.path, path));
    git(sandbox.path, ['init']);
    git(sandbox.path, ['add', '.']);
    unlinkSync(join(sandbox.path, path));
    symlinkSync('working-tree.swift', join(sandbox.path, path));
    const session = await openSession(sandbox.path);
    const selected = session.scopes[0]!;
    const spec = selected.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'xcode/symlinks')!;
    const input = {
        session,
        root: sandbox.path,
        scope: '',
        view: selected.view,
        spec,
        files: session.repository.files,
    };
    expect(await projectSymlinks(input)).toEqual([
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
    git(sandbox.path, ['add', '.']);
    expect(await projectSymlinks(input)).toEqual([]);
    writeFileSync(join(sandbox.path, '.git', 'index'), 'broken');
    await rejects(projectSymlinks(input), { message: /Cannot read the Git index/u });
});

test('Xcode source membership does not mix independent nested projects', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["xcode"]\n[[scope]]\npath = "nested"\npresets = ["xcode"]\n',
        'Root.xcodeproj/project.pbxproj': 'path = Root.swift;',
        'Root.swift': 'let root = 1\n',
        'nested/Nested.xcodeproj/project.pbxproj': 'path = Nested.swift;',
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let extra = 1\n',
    });
    const session = await openSession(sandbox.path);
    for (const selected of session.scopes) {
        const spec = selected.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'xcode/orphan-sources')!;
        const findings = await orphanSources({
            session,
            root: sandbox.path,
            scope: selected.scope.path,
            view: selected.view,
            spec,
            files: session.repository.files,
        });
        expect(findings).toEqual(
            selected.scope.path === ''
                ? []
                : [
                      {
                          check: 'xcode/orphan-sources',
                          file: 'nested/Extra.swift',
                          line: 1,
                          rule: 'no-target',
                          fixable: false,
                          message: 'This Swift file is in no target of the project.',
                      },
                  ],
        );
    }
});
