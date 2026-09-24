import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { runBlocking } from '#cli/platform/spawn.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';

test('hook discovery preserves path whitespace and refuses malformed Git configuration', async () => {
    const hooksPath = ' .custom hooks';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [`${hooksPath}/pre-commit`]: '#!/bin/sh\nexit 0\n' });
    const initialized = runBlocking(['git', 'init', '-q'], { cwd: sandbox.path });
    expect(initialized.code, initialized.stderr).toBe(0);
    const configured = runBlocking(['git', 'config', 'core.hooksPath', hooksPath], { cwd: sandbox.path });
    expect(configured.code, configured.stderr).toBe(0);
    expect(existingTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: hooksPath, files: ['pre-commit'] },
    ]);
    writeFileSync(join(sandbox.path, '.git/config'), '[core\n');
    expect(() => existingTooling(sandbox.path, [], [])).toThrow('Git configuration core.hooksPath failed');
});

test('tool discovery rejects linked hook directories and accepts the corrected directory', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/README.md': 'project\n',
        'outside/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const root = join(sandbox.path, 'project');
    symlinkSync('../outside', join(root, '.husky'));
    expect(() => existingTooling(root, [], [])).toThrow('Unsafe lifecycle destination');
    expect(readFileSync(join(sandbox.path, 'outside/pre-commit'), 'utf8')).toBe('#!/bin/sh\nexit 0\n');
    unlinkSync(join(root, '.husky'));
    await createFileTree(root, { '.husky/pre-commit': '#!/bin/sh\nexit 0\n' });
    expect(existingTooling(root, [], []).hooks).toStrictEqual([{ kind: 'husky', path: '.husky', files: ['pre-commit'] }]);
});

test('tool discovery reads an external hook directory only through the Git-resolved boundary', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'project/README.md': 'project\n',
        'hooks/pre-commit': '#!/bin/sh\nexit 0\n',
    });
    const root = join(sandbox.path, 'project');
    expect(runBlocking(['git', 'init', '-q'], { cwd: root }).code).toBe(0);
    expect(runBlocking(['git', 'config', 'core.hooksPath', '../hooks'], { cwd: root }).code).toBe(0);
    expect(existingTooling(root, [], []).hooks).toStrictEqual([
        { kind: 'hooksPath', path: '../hooks', files: ['pre-commit'] },
    ]);
});

test('simple-git-hooks is detected from its package configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'package.json': '{"simple-git-hooks":{"pre-commit":"echo authored"}}\n' });
    expect(existingTooling(sandbox.path, [], []).hooks).toStrictEqual([
        { kind: 'simple-git-hooks', path: 'package.json', files: [] },
    ]);
});

test('pre-commit is detected from its native configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { '.pre-commit-config.yaml': 'repos: []\n' });
    const files = [
        {
            path: '.pre-commit-config.yaml',
            nature: 'source' as const,
            tags: [],
            prefix: Buffer.from('repos: []'),
            natureSource: 'default' as const,
            executable: false,
            size: 10,
        },
    ];
    expect(existingTooling(sandbox.path, files, []).hooks).toStrictEqual([
        { kind: 'pre-commit', path: '.pre-commit-config.yaml', files: [] },
    ]);
});

test('adoption discovers nested authored configuration without adopting managed or vendored inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'src/.prettierrc.json': '{"semi":false}',
        'vendor/.prettierrc.json': '{"semi":true}',
        '.gspot/.prettierrc.json': '{"tabWidth":8}',
        '.gspot/package.json': 'unowned malformed output',
        'nested/.gspot/package.json': 'unowned nested output',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const discovered = existingTooling(sandbox.path, repository.files, []);
    expect(discovered.configs.map((entry) => entry.path)).toStrictEqual(['src/.prettierrc.json']);
    expect(readFileSync(join(sandbox.path, '.gspot/package.json'), 'utf8')).toBe('unowned malformed output');
    expect(readFileSync(join(sandbox.path, 'vendor/.prettierrc.json'), 'utf8')).toBe('{"semi":true}');
});
