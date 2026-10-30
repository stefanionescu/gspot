import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { UNCLOSED_PACKAGES } from '#tests/config/yaml.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { rm, mkdir, symlink, writeFile } from 'node:fs/promises';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';

import {
    INACTIVE_LERNA_FILES,
    NESTED_WORKSPACE_FILES,
    OUTSIDE_WORKSPACE_FILES,
} from '#tests/config/repository/npm/workspaces.ts';

test('workspace detection stays inside the folder', async () => {
    await using sandbox = await testdir(NESTED_WORKSPACE_FILES);

    for (const folder of ['child', 'empty']) {
        const root = join(sandbox.path, folder);
        expect(listWorkspaceFolders(root)).toStrictEqual([]);
    }
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), UNCLOSED_PACKAGES);
    expect(listWorkspaceFolders(join(sandbox.path, 'empty'))).toStrictEqual([]);
});

test.each([...OUTSIDE_WORKSPACE_FILES])(
    'workspace detection refuses a package folder outside the repository from %s',
    async (path, declaration, escaped) => {
        await using sandbox = await testdir({
            'project/package.json': '{}',
            [`project/${path}`]: declaration,
            'project/packages/.keep': '',
            'outside/package.json': '{"name":"outside"}',
            'outside/app/package.json': '{"name":"outside-app"}',
        });

        const root = join(sandbox.path, 'project');
        await symlink('../../outside', join(root, 'packages/linked'), 'dir');
        expect(() => listWorkspaceFolders(root)).toThrow(`Workspace package leaves the repository: ${join(escaped)}`);
        expect(listWorkspaceFolders(join(root, 'packages'))).toStrictEqual([]);
    },
);

test('workspace detection does not parse an unused lower-priority file', async () => {
    await using sandbox = await testdir(INACTIVE_LERNA_FILES);

    expect(listWorkspaceFolders(sandbox.path)).toStrictEqual(['packages/app']);
});

test.each(['pnpm-workspace.yaml', 'lerna.json'])(
    'an invalid or unreadable %s is a GspotError that names the file',
    async (path) => {
        await using sandbox = await testdir({ 'package.json': '{}', [path]: '{' });

        const invalid = await captureRejection(Promise.try(() => listWorkspaceFolders(sandbox.path)));
        expect(invalid).toMatchObject({ name: 'GspotError', code: 'filesystem', cause: expect.any(Error) as Error });
        expect(invalid.message).toStartWith(`${path} is not a valid workspace file: `);
        await rm(join(sandbox.path, path));
        await mkdir(join(sandbox.path, path));
        const unreadable = await captureRejection(Promise.try(() => listWorkspaceFolders(sandbox.path)));
        expect(unreadable).toMatchObject({ name: 'GspotError', code: 'filesystem', cause: expect.any(Error) as Error });
        expect(unreadable.message).toStartWith(`${path} is not a valid workspace file: `);
    },
);
