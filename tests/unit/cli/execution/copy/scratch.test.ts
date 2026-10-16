import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/setup/git.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { copyRevision } from '#cli/checks/run/copy/revision.ts';
import { WORKSPACE_SOURCE_FILES } from '#tests/config/execution.ts';
import { mkdir, symlink, readFile, realpath, writeFile } from 'node:fs/promises';
import { checkCopyInputs, copyIntoScratch, projectCopyInputs } from '#cli/checks/run/copy/scratch.ts';

test('a dry-run copy holds workspace dependencies and working bin links, and edits in it reach neither source', async () => {
    await using repository = await testdir();
    await using external = await testdir();
    await createFileTree(repository.path, {
        'gspot.toml': settingsText([]),
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/bin/tool.js': 'console.log(require("../lib/value.cjs"));',
        'node_modules/tool/lib/value.cjs': 'module.exports = "tool works";',
    });
    await createFileTree(external.path, { 'value.js': 'external original' });
    await mkdir(join(repository.path, 'node_modules/.bin'));
    await symlink('../tool/bin/tool.js', join(repository.path, 'node_modules/.bin/tool'));
    await symlink('../packages/core', join(repository.path, 'node_modules/core'));
    await symlink(external.path, join(repository.path, 'node_modules/external'));
    const session = await openSession(repository.path);
    using copy = await copyIntoScratch(
        projectCopyInputs(
            session.root,
            ['packages/core/value.js'],
            session.repository.scopes.map((scope) => scope.path),
        ),
    );
    const scratch = copy.path;
    const result = runCommandBlocking(['node', 'node_modules/.bin/tool'], { cwd: scratch });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('tool works');
    await writeFile(join(scratch, 'node_modules/core/value.js'), 'preview edit');
    await writeFile(join(scratch, 'node_modules/external/value.js'), 'external preview edit');
    expect(await readFile(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe('export default "original";');
    expect(await readFile(join(external.path, 'value.js'), 'utf8')).toBe('external original');
});

test('a workspace member that is no scope brings its own dependency store into the copy', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'package.json': '{"private":true,"workspaces":["tests"]}',
        'tests/package.json': '{"name":"tests"}',
        'tests/app.js': 'import "vue";',
        'node_modules/.bun/vue@3/node_modules/vue/package.json': '{"name":"vue"}',
        '.gspot/package.json': '{"private":true}',
        '.gspot/node_modules/prettier/package.json': '{"name":"prettier"}',
    });
    await mkdir(join(repository.path, 'tests/node_modules'));
    await symlink('../../node_modules/.bun/vue@3/node_modules/vue', join(repository.path, 'tests/node_modules/vue'));
    const paths = ['package.json', 'tests/package.json', 'tests/app.js', '.gspot/package.json'];
    using copy = await copyIntoScratch(projectCopyInputs(repository.path, paths, ['']));
    const scratch = copy.path;
    expect(await readFile(join(scratch, 'tests/node_modules/vue/package.json'), 'utf8')).toBe('{"name":"vue"}');
    expect(await readFile(join(scratch, '.gspot/node_modules/prettier/package.json'), 'utf8')).toBe(
        '{"name":"prettier"}',
    );
});

test('a link into another linked tree points at the copy of that tree, whatever order the folder lists them in', async () => {
    await using repository = await testdir();
    await using store = await testdir();
    await createFileTree(store.path, {
        'next@16/node_modules/next/package.json': '{"name":"next"}',
        'next@16/node_modules/helpers/package.json': '{"name":"helpers"}',
    });
    await createFileTree(repository.path, { 'package.json': '{"private":true}' });
    await mkdir(join(repository.path, 'node_modules'));
    await symlink(join(store.path, 'next@16/node_modules/next'), join(repository.path, 'node_modules/a-next'), 'dir');
    await symlink(store.path, join(repository.path, 'node_modules/z-store'), 'dir');
    using copy = await copyIntoScratch(projectCopyInputs(repository.path, ['package.json'], ['']));
    const scratch = copy.path;
    const copied = await realpath(join(scratch, 'node_modules/a-next'));
    expect(copied.startsWith(await realpath(join(scratch, 'node_modules/z-store')))).toBe(true);
    expect(await pathExists(join(copied, '../helpers/package.json'))).toBe(true);
});

test('a dependency link that points at nothing refuses the copy', async () => {
    await using repository = await testdir();
    await createFileTree(repository.path, {
        'package.json': '{"private":true}',
        'node_modules/.bin/tool': '#!/bin/sh\n',
    });
    await symlink('../missing/bin/gspot', join(repository.path, 'node_modules/.bin/gspot'));
    expect(copyIntoScratch(projectCopyInputs(repository.path, ['package.json'], ['']))).rejects.toMatchObject({
        code: 'ENOENT',
    });
    expect(await readFile(join(repository.path, 'node_modules/.bin/tool'), 'utf8')).toBe('#!/bin/sh\n');
});

test.each([false, true])(
    "a check's scratch copy holds its files and dependencies, plus an extra file when asked: %s",
    async (extra) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': settingsText(['javascript']),
            'selected.js': 'export const selected = 1;',
            'unselected.js': 'export const unselected = 2;',
            'document.json': '{"value":3}',
            'node_modules/tool/value.js': 'export const dependency = 4;',
        });
        const session = await openSession(repository.path);
        const input = buildCheckInput(session, 'javascript/tsc', { paths: ['selected.js'] });
        using copy = await copyIntoScratch(checkCopyInputs(input, extra ? ['document.json'] : []));
        expect(await readFile(join(copy.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
        expect(await readFile(join(copy.path, 'node_modules/tool/value.js'), 'utf8')).toBe(
            'export const dependency = 4;',
        );
        expect(await pathExists(join(copy.path, 'unselected.js'))).toBe(false);
        expect(await pathExists(join(copy.path, 'document.json'))).toBe(extra);
        if (extra) expect(await readFile(join(copy.path, 'document.json'), 'utf8')).toBe('{"value":3}');
        await writeFile(join(copy.path, 'selected.js'), 'changed in private copy');
        expect(await readFile(join(repository.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
    },
);

test.each([false, true])(
    'workspace dependency copies keep the sources the check imports (revision copy %s)',
    async (revision) => {
        await using repository = await testdir();
        await createFileTree(repository.path, {
            'gspot.toml': settingsText(['javascript'], {
                tables: '[[scope]]\npath = "apps/web"\nconfigurations = ["javascript"]\n',
            }),
            ...WORKSPACE_SOURCE_FILES,
        });
        await mkdir(join(repository.path, 'node_modules'));
        for (const name of ['core', 'utility', 'unused'])
            await symlink(`../packages/${name}`, join(repository.path, 'node_modules', name));
        if (revision) {
            gitOutput(repository.path, ['init']);
            gitOutput(repository.path, ['add', '.']);
            await writeFile(join(repository.path, 'packages/core/value.js'), 'export const value = "unstaged";');
            await writeFile(join(repository.path, 'packages/core/untracked.js'), 'private working bytes');
        }
        const inspect = async (root: string) => {
            const session = await openSession(root);
            const input = buildCheckInput(session, 'javascript/eslint', {
                scope: 'apps/web',
                paths: ['apps/web/main.js'],
            });
            const dependencyPaths = input.dependencyFiles();
            expect(new Set(dependencyPaths).size).toBe(dependencyPaths.length);
            expect(dependencyPaths).toContain('packages/core/value.js');
            expect(dependencyPaths).toContain('packages/utility/value.js');
            expect(dependencyPaths).toContain('packages/aliased/value.js');
            expect(dependencyPaths).not.toContain('packages/unused/private.txt');
            expect(dependencyPaths).not.toContain('packages/unused/private.js');
            expect(input.files.map((file) => file.path)).toStrictEqual(['apps/web/main.js']);
            using copy = await copyIntoScratch(checkCopyInputs(input));
            const output = runCommandBlocking([process.execPath, 'apps/web/main.js'], { cwd: copy.path });
            expect(output.code, output.stderr).toBe(0);
            expect(output.stdout.trim()).toBe('staged dependency');
            expect(await readFile(join(copy.path, 'packages/aliased/value.js'), 'utf8')).toBe(
                WORKSPACE_SOURCE_FILES['packages/aliased/value.js'],
            );
            expect(await pathExists(join(copy.path, 'packages/unused/private.txt'))).toBe(false);
            expect(await pathExists(join(copy.path, 'packages/core/untracked.js'))).toBe(false);
            await writeFile(join(copy.path, 'packages/core/value.js'), 'private copy change');
        };
        await (revision ? copyRevision(repository.path, { kind: 'index' }, inspect) : inspect(repository.path));
        expect(await readFile(join(repository.path, 'packages/core/value.js'), 'utf8')).toBe(
            revision
                ? 'export const value = "unstaged";'
                : 'import {suffix} from "utility"; export const value = "staged" + suffix;',
        );
    },
);
