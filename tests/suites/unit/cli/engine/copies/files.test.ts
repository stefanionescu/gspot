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
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'package.json': '{"private":true,"workspaces":["packages/*"]}',
        'packages/core/package.json': '{"name":"core"}',
        'packages/core/value.js': 'export default "original";',
        'node_modules/tool/package.json': '{"name":"tool"}',
        'node_modules/tool/lib/value.txt': 'tool works',
    });
    await using external = await testdir();
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

test("a check's copy holds its files and dependencies, plus an extra file when asked", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'selected.js': 'export const selected = 1;',
        'unselected.js': 'export const unselected = 2;',
        'document.json': '{"value":3}',
        'node_modules/tool/value.js': 'export const dependency = 4;',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'format/prettier', { paths: ['selected.js'] });
    using copy = await createCheckCopy(session, input, ['document.json']);
    expect(await readFile(join(copy.path, 'selected.js'), 'utf8')).toBe('export const selected = 1;');
    expect(existsSync(join(copy.path, 'unselected.js'))).toBe(false);
    expect(await readFile(join(copy.path, 'document.json'), 'utf8')).toBe('{"value":3}');
});

test('the copy of a check that runs once per scope holds the tracked files over the size limit and outside UTF-8', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], { tables: '[repository]\nmax_file_kilobytes = 1\n' }),
        'page.md': '# Page\n',
        'assets/demo.txt': 'a'.repeat(2048),
    });
    await writeFile(join(sandbox.path, 'assets/legacy.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9]));

    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'site/build');
    expect(planned.files.map((file) => file.path)).not.toContain('assets/demo.txt');
    using copy = await createCheckCopy(session, planned);
    const large = await lstat(join(copy.path, 'assets/demo.txt'));
    expect(large.size).toBe(2048);
    expect(await readFile(join(copy.path, 'assets/legacy.txt'))).toStrictEqual(Buffer.from([0x63, 0x61, 0x66, 0xe9]));
});

test('the copy of a check that runs per file leaves out a tracked file over the size limit', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: '[repository]\nmax_file_kilobytes = 1\n' }),
        'selected.js': 'export const selected = 1;',
        'large.js': `export const large = '${'a'.repeat(2048)}';`,
    });

    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'format/prettier');
    using copy = await createCheckCopy(session, planned);
    expect(existsSync(join(copy.path, 'selected.js'))).toBe(true);
    expect(existsSync(join(copy.path, 'large.js'))).toBe(false);
});

test('workspace dependency copies of a revision keep exactly the sources the check imports', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'apps/web', configurations: ['javascript'] }],
        }),
        ...WORKSPACE_SOURCE_FILES,
    });

    await mkdir(join(sandbox.path, 'node_modules'));
    for (const name of ['core', 'utility', 'unused'])
        await symlink(`../packages/${name}`, join(sandbox.path, 'node_modules', name));
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    await writeFile(join(sandbox.path, 'packages/core/value.js'), 'export const value = "unstaged";');
    using revision = await copyRevision(sandbox.path, { kind: 'index' });
    const session = await openSession(revision.root);
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
});
