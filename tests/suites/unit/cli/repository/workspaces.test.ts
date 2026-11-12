import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { listWorkspaceFolders } from '#cli/repository/workspaces.ts';
import { compareText } from '#cli/system/text.ts';
import { WORKSPACE_FILE_CASES } from '#tests/config/repository/setup.ts';
import { UNCLOSED_PACKAGES } from '#tests/config/setup/languages.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const INACTIVE_LERNA_FILES = {
    'package.json': '{}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
    'lerna.json': 'malformed inactive configuration',
    'packages/app/package.json': '{"name":"inside"}',
} as const;

const NESTED_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]',
    'packages/parent/package.json': '{"name":"parent"}',
    'child/package.json': '{}',
    'empty/source.py': '',
} as const;

const OUTSIDE_WORKSPACE_FILES = [
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
] as const;

test.each([...WORKSPACE_FILE_CASES])('each workspace file lists its package folders: %j', async (files) => {
    await using sandbox = await createGitSandbox({
        ...files,
        'packages/api/package.json': '{"dependencies":{"express":"5.0.0"}}',
        'packages/lint/package.json': '{"devDependencies":{"eslint":"10.0.0"}}',
    });

    expect(listWorkspaceFolders(sandbox.path).toSorted(compareText)).toStrictEqual(['packages/api', 'packages/lint']);
});

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
        const refusal = await captureRejection(Promise.try(() => listWorkspaceFolders(root)));
        expect(refusal).toMatchObject({ name: 'GspotError', code: 'filesystem' });
        expect(refusal.message).toContain(join(escaped));
    },
);

test('a workspace package.json that starts with a byte order mark stays a workspace folder', async () => {
    await using sandbox = await testdir({
        'package.json': '{}',
        'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
        'packages/marked/package.json': '\u{FEFF}{"name":"marked"}',
        'packages/plain/package.json': '{"name":"plain"}',
    });

    expect(listWorkspaceFolders(sandbox.path)).toStrictEqual(['packages/marked', 'packages/plain']);
});

test('workspace detection does not parse an unused lower-priority file', async () => {
    await using sandbox = await testdir(INACTIVE_LERNA_FILES);

    expect(listWorkspaceFolders(sandbox.path)).toStrictEqual(['packages/app']);
});

test('an invalid pnpm-workspace.yaml is a GspotError that names the file', async () => {
    await using sandbox = await testdir({ 'package.json': '{}', 'pnpm-workspace.yaml': '{' });

    const invalid = await captureRejection(Promise.try(() => listWorkspaceFolders(sandbox.path)));
    expect(invalid).toMatchObject({ name: 'GspotError', code: 'filesystem', cause: expect.any(Error) as Error });
    expect(invalid.message).toContain('pnpm-workspace.yaml');
});

test('a pnpm-workspace.yaml that cannot be read as a file keeps its read error', async () => {
    await using sandbox = await testdir({ 'package.json': '{}', 'pnpm-workspace.yaml/.keep': '' });

    const unreadable = await captureRejection(Promise.try(() => listWorkspaceFolders(sandbox.path)));
    expect(unreadable).toMatchObject({ code: 'EISDIR' });
});
