import { test, expect } from 'bun:test';
import { join, dirname } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { buildProgramArguments } from '#tests/setup/system/programs.ts';
import { listWorkspaceSources } from '#cli/repository/javascript/workspaces.ts';
import { createCopy, createCheckCopy, selectCopyPaths } from '#cli/runs/copy/files.ts';
import { TEST_WORKSPACE_FILES, WORKSPACE_SOURCE_FILES } from '#tests/config/runs/copy.ts';
import { cp, mkdir, lstat, symlink, readFile, realpath, writeFile } from 'node:fs/promises';

test('a copy isolates workspace sources and links external dependencies and executable tools', async () => {
    await using sandbox = await testdir();
    await using external = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/lib/value.txt': 'tool works',
    });
    const [program = ''] = buildProgramArguments('fakes/package-bin');
    await cp(program, join(sandbox.path, 'node_modules/tool/bin/tool.js'));
    await createFileTree(external.path, { 'value.js': 'external original' });
    await mkdir(join(sandbox.path, 'node_modules/.bin'));
    await symlink('../tool/bin/tool.js', join(sandbox.path, 'node_modules/.bin/tool'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink(external.path, join(sandbox.path, 'node_modules/external'));
    const session = await openSession(sandbox.path);
    using copy = await createCopy(
        selectCopyPaths(
            session.root,
            ['packages/core/value.js'],
            session.repository.scopeFolders.map((scope) => scope.path),
        ),
    );
    const scratch = copy.path;
    const result = runCommandBlocking([process.execPath, 'node_modules/.bin/tool'], { cwd: scratch });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('tool works');
    await writeFile(join(scratch, 'node_modules/core/value.js'), 'preview edit');
    expect(await realpath(join(scratch, 'node_modules/external'))).toBe(await realpath(external.path));
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe('export default "original";');
    expect(await readFile(join(external.path, 'value.js'), 'utf8')).toBe('external original');
});

test('a workspace member that is no scope brings its own dependency store into the copy', async () => {
    await using sandbox = await testdir(TEST_WORKSPACE_FILES);

    await mkdir(join(sandbox.path, 'tests/node_modules'));
    await symlink('../../node_modules/.bun/vue@3/node_modules/vue', join(sandbox.path, 'tests/node_modules/vue'));
    const paths = ['package.json', 'tests/package.json', 'tests/app.js', GSPOT_PATHS.npmProject];
    using copy = await createCopy(selectCopyPaths(sandbox.path, paths, ['']));
    const scratch = copy.path;
    expect(await readFile(join(scratch, 'tests/node_modules/vue/package.json'), 'utf8')).toBe('{"name":"vue"}');
    expect(await readFile(join(scratch, `${GSPOT_PATHS.nodeModules}/prettier/package.json`), 'utf8')).toBe(
        '{"name":"prettier"}',
    );
});

test('a link into another linked tree points at the copy of that tree, whatever order the folder lists them in', async () => {
    await using sandbox = await testdir();
    await using store = await testdir({
        'next@16/node_modules/next/package.json': '{"name":"next"}',
        'next@16/node_modules/helpers/package.json': '{"name":"helpers"}',
    });

    await createFileTree(sandbox.path, { 'package.json': '{"private":true}' });
    await mkdir(join(sandbox.path, 'node_modules'));
    await symlink(join(store.path, 'next@16/node_modules/next'), join(sandbox.path, 'node_modules/a-next'), 'dir');
    await symlink(store.path, join(sandbox.path, 'node_modules/z-store'), 'dir');
    using copy = await createCopy(selectCopyPaths(sandbox.path, ['package.json'], ['']));
    const scratch = copy.path;
    const copied = await realpath(join(scratch, 'node_modules/a-next'));
    const exists = copied.startsWith(await realpath(join(scratch, 'node_modules/z-store')));
    expect(exists).toBe(true);
    expect(await isOnDisk(join(copied, '../helpers/package.json'))).toBe(true);
});

test('a copy sits beside the repository, so it shares a parent folder with the store package it links', async () => {
    await using sandbox = await testdir({
        'project/package.json': '{"private":true}',
        'project/node_modules/.bun/tool@1/node_modules/tool/index.js': 'export {};',
    });

    const root = join(sandbox.path, 'project');
    await symlink('.bun/tool@1/node_modules/tool', join(root, 'node_modules/tool'), 'dir');
    using copy = await createCopy(selectCopyPaths(root, ['package.json'], ['']));
    const parent = await realpath(sandbox.path);
    expect(dirname(copy.path)).toBe(parent);
    expect(await realpath(join(copy.path, 'node_modules/tool/index.js'))).toBe(
        join(parent, 'project/node_modules/.bun/tool@1/node_modules/tool/index.js'),
    );
});

test('a dependency link that points at nothing is left out of the copy', async () => {
    await using sandbox = await testdir({
        'package.json': '{"private":true}',
        'node_modules/.bin/tool': '#!/bin/sh\n',
    });

    await symlink('../missing/bin/gspot', join(sandbox.path, 'node_modules/.bin/gspot'));
    using copy = await createCopy(selectCopyPaths(sandbox.path, ['package.json'], ['']));
    const error = await captureRejection(lstat(join(copy.path, 'node_modules/.bin/gspot')));
    expect(error).toMatchObject({
        code: 'ENOENT',
    });
    expect(await readFile(join(copy.path, 'node_modules/.bin/tool'), 'utf8')).toBe('#!/bin/sh\n');
});

test.each([false, true])(
    "a check's copy holds its files and dependencies, plus an extra file when asked: %p",
    async (includedPaths) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript']),
            'selected.js': 'export const selected = 1;',
            'unselected.js': 'export const unselected = 2;',
            'document.json': '{"value":3}',
            'node_modules/tool/value.js': 'export const dependency = 4;',
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'javascript/tsc', { paths: ['selected.js'] });
        using copy = await createCheckCopy(session, input, includedPaths ? ['document.json'] : []);
        expect(await readFile(join(copy.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
        expect(await readFile(join(copy.path, 'node_modules/tool/value.js'), 'utf8')).toBe(
            'export const dependency = 4;',
        );
        expect(await isOnDisk(join(copy.path, 'unselected.js'))).toBe(false);
        expect(await isOnDisk(join(copy.path, 'document.json'))).toBe(includedPaths);
        if (includedPaths) expect(await readFile(join(copy.path, 'document.json'), 'utf8')).toBe('{"value":3}');
        await writeFile(join(copy.path, 'selected.js'), 'changed in private copy');
        expect(await readFile(join(sandbox.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
    },
);

test.each([false, true])(
    'workspace dependency copies keep exactly the sources the check imports (revision copy %p)',
    async (revision) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                scopes: [{ path: 'apps/web', configurations: ['javascript'] }],
            }),
            ...WORKSPACE_SOURCE_FILES,
        });

        await mkdir(join(sandbox.path, 'node_modules'));
        for (const name of ['core', 'utility', 'unused'])
            await symlink(`../packages/${name}`, join(sandbox.path, 'node_modules', name));
        if (revision) {
            runGitStep(sandbox.path, ['init']);
            runGitStep(sandbox.path, ['add', '.']);
            await writeFile(join(sandbox.path, 'packages/core/value.js'), 'export const value = "unstaged";');
            await writeFile(join(sandbox.path, 'packages/core/untracked.js'), 'private working bytes');
        }
        const assertCheckCopy = async (root: string) => {
            const session = await openSession(root);
            const input = planSandboxCheck(session, 'javascript/eslint', {
                scope: 'apps/web',
                paths: ['apps/web/main.js'],
            });
            const dependencyPaths = listWorkspaceSources(session.cache, input.scope.path, session.repository.files);
            expect(dependencyPaths).toStrictEqual([
                'packages/aliased/package.json',
                'packages/aliased/value.js',
                'packages/core/package.json',
                'packages/core/value.js',
                'packages/utility/package.json',
                'packages/utility/value.js',
            ]);
            expect(input.files.map((file) => file.path)).toStrictEqual(['apps/web/main.js']);
            using copy = await createCheckCopy(session, input);
            const output = runCommandBlocking([process.execPath, 'apps/web/main.js'], { cwd: copy.path });
            expect(output.code, output.stderr).toBe(0);
            expect(output.stdout.trim()).toBe('staged dependency');
            expect(await readFile(join(copy.path, 'packages/aliased/value.js'), 'utf8')).toBe(
                WORKSPACE_SOURCE_FILES['packages/aliased/value.js'],
            );
            expect(await isOnDisk(join(copy.path, 'packages/unused/private.txt'))).toBe(false);
            expect(await isOnDisk(join(copy.path, 'packages/core/untracked.js'))).toBe(false);
            await writeFile(join(copy.path, 'packages/core/value.js'), 'private copy change');
        };
        if (revision) {
            using copy = await copyRevision(sandbox.path, { kind: 'index' });
            await assertCheckCopy(copy.root);
        } else await assertCheckCopy(sandbox.path);
        expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe(
            revision
                ? 'export const value = "unstaged";'
                : 'import {suffix} from "utility"; export const value = "staged" + suffix;',
        );
    },
);
