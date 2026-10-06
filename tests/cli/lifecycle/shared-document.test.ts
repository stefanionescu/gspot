import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { hasFields } from '#cli/lifecycle/merge/document.ts';

test('shared output readers reject external links', async () => {
    await using sandbox = await testdir();
    const original = 'extends = "./.gspot/tsconfig.json"\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(sandbox.path, { 'project/.keep': '', outside: original });
    const project = join(sandbox.path, 'project');
    symlinkSync(join(sandbox.path, 'outside'), join(project, 'linked.toml'));
    const path = 'linked.toml';
    expect(() => hasFields(project, { path, changes: [] })).toThrow('private regular file');
    expect(() =>
        hasFields(project, {
            path,
            changes: [{ path: ['scripts', 'check'], value: 'gspot check' }],
        }),
    ).toThrow('private regular file');
});

test('malformed shared TOML fails inspection', async () => {
    await using sandbox = await testdir();
    const source = '[tasks\n';
    await createFileTree(sandbox.path, { 'mise.toml': source });
    expect(() => hasFields(sandbox.path, { path: 'mise.toml', changes: [] })).toThrow(
        'mise.toml is not valid TOML. Fix the file, then run gspot apply.',
    );
});
