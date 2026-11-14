import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { captureRejection } from '#tests/setup/matchers.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { CHANGED_CONTEXT } from '#tests/config/setup/sandboxes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import { writeProgramCommand } from '#tests/setup/system/programs.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { prepareNestedRepository } from '#tests/setup/sandboxes/repositories.ts';
import { mkdir, readdir, symlink, copyFile, readFile, readlink, writeFile } from 'node:fs/promises';
import { GIT_HOOK_REPORT, SELECTED_SOURCE, LOWERCASE_SELECT_SQL } from '#tests/config/engine/run.ts';

test('a revision copy of a nested gspot.toml keeps the repository around it', async () => {
    await using sandbox = await testdir();
    const { project, commitId } = await prepareNestedRepository(sandbox.path);
    for (const source of [{ kind: 'index' } as const, { kind: 'commit', hash: commitId } as const]) {
        using copy = await copyRevision(project, source);
        expect(await readFile(join(copy.root, 'source.txt'), 'utf8')).toBe(
            source.kind === 'index' ? 'indexed' : 'pushed',
        );
        expect(await readFile(join(copy.root, '..', 'outside.txt'), 'utf8')).toBe(CHANGED_CONTEXT);
    }
    expect(await readFile(join(project, 'source.txt'), 'utf8')).toBe('working');
});

test.each(['index', 'commit'] as const)('a %s copy keeps gitlinks without reading submodule contents', async (kind) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'source.txt': SELECTED_SOURCE,
    });
    await createFileTree(outside.path, { 'package.json': '{', 'source.txt': 'outside source' });
    runGitStep(sandbox.path, ['init']);
    runGitStep(sandbox.path, ['add', '.']);
    runGitStep(sandbox.path, ['commit', '-qm', 'Source']);
    const commitId = runGitStep(sandbox.path, ['rev-parse', 'HEAD']);
    const path = 'vendor/external project';
    runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},${path}`]);
    runGitStep(sandbox.path, ['commit', '-qm', 'Gitlink']);
    await mkdir(join(sandbox.path, 'vendor'));
    await symlink(outside.path, join(sandbox.path, path), 'dir');
    const expected = runGitStep(sandbox.path, ['write-tree']);
    const source = kind === 'index' ? { kind } : { kind, hash: runGitStep(sandbox.path, ['rev-parse', 'HEAD']) };
    using copy = await copyRevision(sandbox.path, source);
    expect(copy.tree).toBe(expected);
    expect(await readdir(join(copy.root, path))).toStrictEqual([]);
    expect(await readFile(join(copy.root, 'source.txt'), 'utf8')).toBe(SELECTED_SOURCE);
});

test('a Git hook in a linked worktree copies the index and the commit, and keeps its own index, HEAD, Git settings, and cancellation', async () => {
    await using sandbox = await testdir({ 'repository/nested/source.txt': 'committed\n' });

    const root = join(sandbox.path, 'repository');
    commitAll(root);
    const worktree = join(sandbox.path, 'linked');
    runGitStep(root, ['worktree', 'add', '-qb', 'hook-probe', worktree]);
    const folder = runGitStep(worktree, ['rev-parse', '--absolute-git-dir']);
    const index = join(folder, 'custom-index');
    const standard = await readFile(join(folder, 'index'));
    await copyFile(join(folder, 'index'), index);
    await writeFile(join(worktree, 'nested/source.txt'), 'selected\n');
    const staged = runBlockingCommand(['git', 'add', 'nested/source.txt'], {
        cwd: worktree,
        env: { GIT_INDEX_FILE: index },
    });
    expect(staged.code, staged.stderr).toBe(0);
    await writeFile(join(worktree, 'nested/source.txt'), 'working\n');
    const report = join(sandbox.path, 'report.json');
    const timeout = String(rootSettingSchemas.tool_timeout_seconds.parse(undefined));
    const hooks = await writeProgramCommand(sandbox.path, 'hook/pre-commit', 'processes/revisions', timeout, report);
    const result = runBlockingCommand(['git', '-c', `core.hooksPath=${hooks}`, 'commit', '-qm', 'hook'], {
        cwd: worktree,
        env: {
            GIT_INDEX_FILE: index,
            GIT_CONFIG_COUNT: '1',
            GIT_CONFIG_KEY_0: 'gspot.boundary',
            GIT_CONFIG_VALUE_0: 'inherited',
        },
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(await readFile(report, 'utf8'))).toStrictEqual(GIT_HOOK_REPORT);
    expect(runGitStep(worktree, ['symbolic-ref', 'HEAD'])).toBe('refs/heads/hook-probe');
    expect(await readFile(join(worktree, 'nested/source.txt'), 'utf8')).toBe('working\n');
    expect(await readFile(join(folder, 'index'))).toStrictEqual(standard);
});

test.skipIf(isWindows)('an index copy keeps unusual filename bytes and contents', async () => {
    await using sandbox = await testdir();
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: LOWERCASE_SELECT_SQL });
    commitAll(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await readFile(join(copy.root, path), 'utf8')).toBe(LOWERCASE_SELECT_SQL);
});

test('a shallow index copy reads newly staged blobs and preserves its shallow history', async () => {
    await using sandbox = await testdir({ 'origin/source.txt': 'committed\n' });
    const origin = join(sandbox.path, 'origin');
    const checkout = join(sandbox.path, 'shallow');
    commitAll(origin);
    runGitStep(origin, ['commit', '--allow-empty', '-qm', 'Second']);
    runGitStep(sandbox.path, ['clone', '--quiet', '--depth', '1', pathToFileURL(origin).href, checkout]);
    await writeFile(join(checkout, 'new.txt'), 'new staged blob\n');
    runGitStep(checkout, ['add', 'new.txt']);
    using copy = await copyRevision(checkout, { kind: 'index' });
    expect(await readFile(join(copy.root, 'new.txt'), 'utf8')).toBe('new staged blob\n');
    expect(runGitStep(copy.root, ['rev-list', '--count', 'HEAD'])).toBe('1');
});

test.skipIf(isWindows)('a revision copy links the packages of a node_modules that is a link', async () => {
    await using sandbox = await testdir({
        'project/package.json': '{"private":true}',
        'project/package-lock.json': '{}',
        'project/.gitignore': 'node_modules\n',
        'installed/example/index.js': SELECTED_SOURCE,
    });
    const project = join(sandbox.path, 'project');
    await symlink(join(sandbox.path, 'installed'), join(project, 'node_modules'), 'dir');
    commitAll(project);
    using copy = await copyRevision(project, { kind: 'index' });
    expect(await readFile(join(copy.root, 'node_modules/example/index.js'), 'utf8')).toBe(SELECTED_SOURCE);
});

test.skipIf(isWindows)('a revision copy keeps a committed link', async () => {
    await using sandbox = await testdir({ 'target.txt': SELECTED_SOURCE });
    await symlink('target.txt', join(sandbox.path, 'linked.txt'));
    commitAll(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await readlink(join(copy.root, 'linked.txt'))).toBe('target.txt');
});

test('a copy runs no global Git filter or line conversion, and its checks read the attributes of the revision', async () => {
    await using sandbox = await testdir({
        '.gitattributes': 'large.bin filter=lfs\n',
        'large.bin': 'pointer\n',
        'notes.txt': 'one\ntwo\n',
        'settings/global': '[filter "lfs"]\n\tsmudge = false\n\trequired = true\n[core]\n\tautocrlf = true\n',
    });
    commitAll(sandbox.path);
    using _environment = overrideEnvironment({ GIT_CONFIG_GLOBAL: join(sandbox.path, 'settings/global') });
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await readFile(join(copy.root, 'large.bin'), 'utf8')).toBe('pointer\n');
    expect(await readFile(join(copy.root, 'notes.txt'), 'utf8')).toBe('one\ntwo\n');
    expect(runGitStep(copy.root, ['check-attr', 'filter', 'large.bin'])).toContain('lfs');
});

test.skipIf(isWindows)(
    'a revision copy whose .gspot is a link gets no Vale package link outside the copy',
    async () => {
        await using sandbox = await testdir({ 'work/source.txt': SELECTED_SOURCE, 'outside/vale/styles/.keep': '' });
        const work = join(sandbox.path, 'work');
        await symlink(join(sandbox.path, 'outside'), join(work, '.gspot'), 'dir');
        commitAll(work);
        const error = await captureRejection(copyRevision(work, { kind: 'index' }));
        expect(error).toMatchObject({ name: 'GspotError', code: 'filesystem' });
        expect(await readdir(join(sandbox.path, 'outside/vale'))).toStrictEqual(['styles']);
    },
);
