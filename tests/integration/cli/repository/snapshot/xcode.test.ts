import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rejects } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { gitOutput } from '#tests/support/cli/git.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { onPosix } from '#tests/support/cli/platforms.ts';
import { containing } from '#tests/support/expectations.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { unlinkSync, symlinkSync, readFileSync, writeFileSync } from 'node:fs';
import { orphanSources, projectSymlinks } from '#cli/checks/xcode/project/checks.ts';

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
        const input = engineInput(session, {
            scope: session.scopes.find((entry) => entry.scope.path === '')!,
            spec: spec,
            files: session.repository.files,
        });
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

test('Xcode source membership does not mix independent nested projects', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xcode'], '[[scope]]\npath = "nested"\nkits = ["xcode"]\n'),
        'Root.xcodeproj/project.pbxproj': `{
    rootObject = P;
    objects = {
        P = {isa = PBXProject; mainGroup = G; targets = (T,); };
        G = {isa = PBXGroup; children = (F,); sourceTree = "<group>"; };
        F = {isa = PBXFileReference; path = "Root.swift"; sourceTree = "<group>"; };
        B = {isa = PBXBuildFile; fileRef = F; };
        S = {isa = PBXSourcesBuildPhase; files = (B,); };
        T = {isa = PBXNativeTarget; buildPhases = (S,); };
    };
}`,
        'Root.swift': 'let root = 1\n',
        'nested/Nested.xcodeproj/project.pbxproj': `{
    rootObject = P;
    objects = {
        P = {isa = PBXProject; mainGroup = G; targets = (T,); };
        G = {isa = PBXGroup; children = (F,); sourceTree = "<group>"; };
        F = {isa = PBXFileReference; path = "Nested.swift"; sourceTree = "<group>"; };
        B = {isa = PBXBuildFile; fileRef = F; };
        S = {isa = PBXSourcesBuildPhase; files = (B,); };
        T = {isa = PBXNativeTarget; buildPhases = (S,); };
    };
}`,
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let extra = 1\n',
    });
    const session = await openSession(sandbox.path);
    for (const selected of session.scopes) {
        const spec = selected.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'xcode/orphan-sources')!;
        const findings = orphanSources(
            engineInput(session, {
                scope: session.scopes.find((entry) => entry.scope.path === selected.scope.path)!,
                spec: spec,
                files: session.repository.files,
            }),
        );
        expect(findings).toStrictEqual(
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
