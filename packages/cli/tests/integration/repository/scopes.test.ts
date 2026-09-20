import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createSandbox } from '@gspot/testing';
import { mkdirSync, writeFileSync } from 'node:fs';
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
    await using sandbox = await createSandbox({
        ...files,
        'packages/api/package.json': '{"dependencies":{"express":"5.0.0"}}',
        'packages/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
    });
    const repository = await readRepository(sandbox.path, [], []);
    const found = workspaceScopes(sandbox.path, readManifests(sandbox.path, repository.files));
    expect(found.scopes.map((scope) => scope.path)).toEqual(['packages/api']);
    expect(found.lintOnly).toEqual(['packages/lint/package.json']);
});

test('workspace discovery stays within the requested root', async () => {
    await using sandbox = await createSandbox({
        'package.json': '{"workspaces":["packages/*"]}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]',
        'packages/parent/package.json': '{"name":"parent"}',
        'child/package.json': '{}',
        'empty/source.py': '',
    });
    for (const directory of ['child', 'empty']) {
        const root = join(sandbox.path, directory);
        const repository = await readRepository(root, [], []);
        expect(workspaceScopes(root, readManifests(root, repository.files)).scopes).toEqual([]);
    }
    writeFileSync(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
    expect(workspaceScopes(join(sandbox.path, 'empty'), []).scopes).toEqual([]);
});

test.each(['pnpm-workspace.yaml', 'lerna.json', 'rush.json'])(
    'invalid or unreadable %s cannot become an empty workspace',
    async (path) => {
        await using sandbox = await createSandbox({ 'package.json': '{}', [path]: '{' });
        expect(() => workspaceScopes(sandbox.path, [])).toThrow();
        await Bun.file(join(sandbox.path, path)).delete();
        mkdirSync(join(sandbox.path, path));
        expect(() => workspaceScopes(sandbox.path, [])).toThrow();
    },
);
