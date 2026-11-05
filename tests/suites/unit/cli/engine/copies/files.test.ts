import { existsSync } from 'node:fs';
import { cp, lstat, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { createCheckCopy } from '#cli/engine/copies/files.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { openSession } from '#cli/engine/session.ts';
import { TEST_WORKSPACE_FILES, WORKSPACE_SOURCE_FILES } from '#tests/config/engine/files.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a copy isolates workspace sources and links external dependencies and executable tools', async () => {
    await using sandbox = await createGitSandbox({});
    await using external = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/lib/value.txt': 'tool works',
    });
    const [, program = ''] = buildProgramCommand('fakes/package-bin');
    await cp(program, join(sandbox.path, 'node_modules/tool/bin/tool.js'));
    await createFileTree(external.path, { 'value.js': 'external original' });
    await mkdir(join(sandbox.path, 'node_modules/.bin'));
    await symlink('../tool/bin/tool.js', join(sandbox.path, 'node_modules/.bin/tool'));
    await symlink('../packages/core', join(sandbox.path, 'node_modules/core'));
    await symlink(external.path, join(sandbox.path, 'node_modules/external'));
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'gspot/generated-files', { paths: ['packages/core/value.js'] });
    using copy = await createCheckCopy(session, planned);
    const scratch = copy.path;
    const result = runBlockingCommand([process.execPath, 'node_modules/.bin/tool'], { cwd: scratch });
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('tool works');
    await writeFile(join(scratch, 'node_modules/core/value.js'), 'preview edit');
    expect(await realpath(join(scratch, 'node_modules/external'))).toBe(await realpath(external.path));
    expect(await readFile(join(sandbox.path, 'packages/core/value.js'), 'utf8')).toBe('export default "original";');
    expect(await readFile(join(external.path, 'value.js'), 'utf8')).toBe('external original');
});

test('a workspace member that is no scope brings its own dependency store into the copy', async () => {
    await using sandbox = await createGitSandbox({ ...TEST_WORKSPACE_FILES, 'gspot.toml': buildSandboxSettings([]) });

    await mkdir(join(sandbox.path, 'tests/node_modules'));
    await symlink('../../node_modules/.bun/vue@3/node_modules/vue', join(sandbox.path, 'tests/node_modules/vue'));
    const paths = ['package.json', 'tests/package.json', 'tests/app.js', GSPOT_PATHS.npmProject];
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'gspot/generated-files', { paths });
    using copy = await createCheckCopy(session, planned, [GSPOT_PATHS.npmProject]);
    const scratch = copy.path;
    expect(await readFile(join(scratch, 'tests/node_modules/vue/package.json'), 'utf8')).toBe('{"name":"vue"}');
    expect(await readFile(join(scratch, `${GSPOT_PATHS.nodeModules}/prettier/package.json`), 'utf8')).toBe(
        '{"name":"prettier"}',
    );
});

test('a copy sits inside the repository, so linked store packages share its root', async () => {
    await using sandbox = await createGitSandbox({
        'project/package.json': '{"private":true}',
        'project/gspot.toml': buildSandboxSettings([]),
        'project/node_modules/.bun/tool@1/node_modules/tool/index.js': 'export {};',
    });

    const root = join(sandbox.path, 'project');
    await symlink('.bun/tool@1/node_modules/tool', join(root, 'node_modules/tool'), 'dir');
    const session = await openSession(root);
    const planned = planSandboxCheck(session, 'gspot/generated-files', { paths: ['package.json'] });
    using copy = await createCheckCopy(session, planned);
    const parent = await realpath(sandbox.path);
    expect(dirname(copy.path)).toBe(join(parent, 'project/.gspot-copies'));
    expect(await realpath(join(copy.path, 'node_modules/tool/index.js'))).toBe(
        join(parent, 'project/node_modules/.bun/tool@1/node_modules/tool/index.js'),
    );
});

test('a dependency link that points at nothing is left out of the copy', async () => {
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}',
        'node_modules/.bin/tool': '#!/bin/sh\n',
        'gspot.toml': buildSandboxSettings([]),
    });

    await symlink('../missing/bin/gspot', join(sandbox.path, 'node_modules/.bin/gspot'));
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'gspot/generated-files', { paths: ['package.json'] });
    using copy = await createCheckCopy(session, planned);
    const error = await captureRejection(lstat(join(copy.path, 'node_modules/.bin/gspot')));
    expect(error).toMatchObject({
        code: 'ENOENT',
    });
    expect(await readFile(join(copy.path, 'node_modules/.bin/tool'), 'utf8')).toBe('#!/bin/sh\n');
});

test.each([false, true])(
    "a check's copy holds its files and dependencies, plus an extra file when asked: %p",
    async (includedPaths) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['javascript']),
            'selected.js': 'export const selected = 1;',
            'unselected.js': 'export const unselected = 2;',
            'document.json': '{"value":3}',
            'node_modules/tool/value.js': 'export const dependency = 4;',
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'format/prettier', { paths: ['selected.js'] });
        using copy = await createCheckCopy(session, input, includedPaths ? ['document.json'] : []);
        expect(await readFile(join(copy.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
        expect(await readFile(join(copy.path, 'node_modules/tool/value.js'), 'utf8')).toBe(
            'export const dependency = 4;',
        );
        expect(existsSync(join(copy.path, 'unselected.js'))).toBe(false);
        expect(existsSync(join(copy.path, 'document.json'))).toBe(includedPaths);
        if (includedPaths) expect(await readFile(join(copy.path, 'document.json'), 'utf8')).toBe('{"value":3}');
        await writeFile(join(copy.path, 'selected.js'), 'changed in private copy');
        expect(await readFile(join(sandbox.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
    },
);

test.each([false, true])(
    'workspace dependency copies keep exactly the sources the check imports (revision copy %p)',
    async (revision) => {
        await using sandbox = await createGitSandbox({
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
            expect(input.files.map((file) => file.path)).toStrictEqual(['apps/web/main.js']);
            using copy = await createCheckCopy(session, input);
            const output = runBlockingCommand([process.execPath, 'apps/web/main.js'], { cwd: copy.path });
            expect(output.code, output.stderr).toBe(0);
            expect(output.stdout.trim()).toBe('staged dependency');
            expect(await readFile(join(copy.path, 'packages/aliased/value.js'), 'utf8')).toBe(
                WORKSPACE_SOURCE_FILES['packages/aliased/value.js'],
            );
            expect(existsSync(join(copy.path, 'packages/unused/private.txt'))).toBe(false);
            expect(existsSync(join(copy.path, 'packages/core/untracked.js'))).toBe(false);
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
