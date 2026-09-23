import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { mkdirSync, writeFileSync, symlinkSync, readFileSync, unlinkSync } from 'node:fs';
import { readRepository } from '#cli/repository/tree.ts';
import { workspaceScopes } from '#cli/repository/scopes.ts';
import { readManifests } from '#cli/repository/manifests.ts';

test.each([
    { 'package.json': '{"workspaces":["packages/*"]}' },
    { 'package.json': '{"workspaces":{"packages":["packages/*"]}}' },
    { 'package.json': '{}', 'pnpm-workspace.yaml': 'packages: ["packages/*"]' },
    { 'package.json': '{}', 'lerna.json': '{"packages":["packages/*"]}' },
    {
        'rush.json':
            '{"projects":[{"packageName":"api","projectFolder":"packages/api"},{"packageName":"lint","projectFolder":"packages/lint"}]}',
    },
])('workspace declarations select application packages and separate lint-only packages: %j', async (files) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...files,
        'packages/api/package.json': '{"dependencies":{"express":"5.0.0"}}',
        'packages/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
    });
    const repository = await readRepository(sandbox.path, [], [], []);
    const found = workspaceScopes(sandbox.path, readManifests(sandbox.path, repository.files));
    expect(found.scopes.map((scope) => scope.path)).toEqual(['packages/api']);
    expect(found.lintOnly).toEqual(['packages/lint/package.json']);
});

test('workspace discovery stays within the requested root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"workspaces":["packages/*"]}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]',
        'packages/parent/package.json': '{"name":"parent"}',
        'child/package.json': '{}',
        'empty/source.py': '',
    });
    for (const directory of ['child', 'empty']) {
        const root = join(sandbox.path, directory);
        const repository = await readRepository(root, [], [], []);
        expect(workspaceScopes(root, readManifests(root, repository.files)).scopes).toEqual([]);
    }
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    expect(workspaceScopes(join(sandbox.path, 'empty'), []).scopes).toEqual([]);
});

test.each(['pnpm-workspace.yaml', 'lerna.json', 'rush.json'])(
    'invalid or unreadable %s cannot become an empty workspace',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'package.json': '{}', [path]: '{' });
        expect(() => workspaceScopes(sandbox.path, [])).toThrow();
        await Bun.file(join(sandbox.path, path)).delete();
        mkdirSync(join(sandbox.path, path));
        expect(() => workspaceScopes(sandbox.path, [])).toThrow();
    },
);

test.each(['../outside', 'packages/*', 'packages/**/app', '{../outside,packages/app}'])(
    'workspace preflight refuses escaped or linked package patterns: %s',
    async (pattern) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'project/package.json': '{}',
            'project/pnpm-workspace.yaml': `packages: [${JSON.stringify(pattern)}]\n`,
            'project/packages/.keep': '',
            'outside/package.json': '{"name":"outside"}',
            'outside/app/package.json': '{"name":"outside-app"}',
        });
        const root = join(directory.path, 'project');
        symlinkSync('../../outside', join(root, 'packages/linked'));
        expect(() => workspaceScopes(root, [])).toThrow(/lifecycle/iu);
        expect(readFileSync(join(directory.path, 'outside/package.json'), 'utf8')).toBe('{"name":"outside"}');
        unlinkSync(join(root, 'packages/linked'));
        writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]\n');
        await createFileTree(root, { 'packages/app/package.json': '{"name":"inside"}' });
        expect(workspaceScopes(root, []).scopes.map((scope) => scope.path)).toEqual(['packages/app']);
    },
);

test('workspace selection does not parse an inactive lower-priority configuration', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'package.json': '{}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
        'lerna.json': 'malformed inactive configuration',
        'packages/app/package.json': '{"name":"inside"}',
    });
    expect(workspaceScopes(directory.path, []).scopes.map((scope) => scope.path)).toEqual(['packages/app']);
});
