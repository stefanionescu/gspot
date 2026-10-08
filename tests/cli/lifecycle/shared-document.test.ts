import { test } from 'bun:test';
import { join } from 'node:path';
import { symlink } from 'node:fs/promises';
import { throws } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { hasFields } from '#cli/lifecycle/merge/document.ts';

test('shared output readers reject external links', async () => {
    await using sandbox = await testdir();
    const original = 'extends = "./.gspot/tsconfig.json"\n[scripts]\ncheck = "gspot check"\n';
    await createFileTree(sandbox.path, { 'project/.keep': '', outside: original });
    const project = join(sandbox.path, 'project');
    await symlink(join(sandbox.path, 'outside'), join(project, 'linked.toml'));
    const path = 'linked.toml';
    throws(() => hasFields(project, { path, changes: [{ path: ['scripts', 'check'], value: 'gspot check' }] }), {
        message: 'Lifecycle destination is not a private regular file: linked.toml',
    });
});

test('malformed shared TOML fails inspection', async () => {
    await using sandbox = await testdir();
    const source = '[tasks\n';
    await createFileTree(sandbox.path, { 'mise.toml': source });
    throws(() => hasFields(sandbox.path, { path: 'mise.toml', changes: [] }), {
        message: 'mise.toml is not valid TOML. Fix the file, then run gspot apply.',
    });
});
