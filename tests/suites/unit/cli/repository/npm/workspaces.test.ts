import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { rm, mkdir, symlink, writeFile } from 'node:fs/promises';
import { listWorkspaceFolders } from '#cli/repository/npm/workspaces.ts';

import {
    INACTIVE_LERNA_FILES,
    NESTED_WORKSPACE_FILES,
    OUTSIDE_WORKSPACE_FILES,
    INVALID_WORKSPACE_FILES,
} from '#tests/config/repository/npm/workspaces.ts';

test('workspace detection stays inside the given folder', async () => {
    await using sandbox = await testdir(NESTED_WORKSPACE_FILES);

    for (const folder of ['child', 'empty']) {
        const root = join(sandbox.path, folder);
        expect(listWorkspaceFolders(root)).toStrictEqual([]);
    }
    await writeFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'packages: [');
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
test.each([...INVALID_WORKSPACE_FILES])(
    'an invalid or unreadable $path is a GspotError that names the file',
    async ({ path, parseError }) => {
        await using sandbox = await testdir({ 'package.json': '{}', [path]: '{' });

        expect(() => listWorkspaceFolders(sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: parseError,
                cause: expect.any(Error),
            }),
        );
        await rm(join(sandbox.path, path));
        await mkdir(join(sandbox.path, path));
        expect(() => listWorkspaceFolders(sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: `${path} is not a valid workspace file: EISDIR: illegal operation on a directory, read. Fix the file.`,
                cause: expect.any(Error),
            }),
        );
    },
);
