import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { LOWERCASE_SELECT_SQL } from '#tests/config/sql.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { CHANGED_CONTEXT } from '#tests/config/setup/sandboxes.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { readHead, listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { prepareNestedRepository } from '#tests/setup/sandboxes/repositories.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { SELECTED_SOURCE, GIT_HOOK_REPORT } from '#tests/config/runs/copy/revision.ts';
import { mkdir, readdir, symlink, copyFile, readFile, writeFile } from 'node:fs/promises';

test('a revision copy of a nested gspot.toml keeps the repository around it', async () => {
    await using sandbox = await testdir();
    const { project, commitId } = await prepareNestedRepository(sandbox.path);
    const head = await readHead(project);
    const headFiles = await listRevisionFiles(project, { kind: 'commit', hash: head! });
    expect(headFiles.map((file) => file.path)).toStrictEqual(['source.txt']);
    const files = await listRevisionFiles(project, { kind: 'index' });
    expect(files.map((file) => file.path)).toStrictEqual(['source.txt']);
    for (const source of [{ kind: 'index' } as const, { kind: 'commit', hash: commitId } as const]) {
        using copy = await copyRevision(project, source);
        expect(await readFile(join(copy.root, 'source.txt'), 'utf8')).toBe(
            source.kind === 'index' ? 'indexed' : 'pushed',
        );
        expect(await readFile(join(copy.root, '..', 'outside.txt'), 'utf8')).toBe(CHANGED_CONTEXT);
        expect(runGitStep(copy.root, ['write-tree'])).toBe(copy.tree);
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
    expect(listSubmodulePaths(await readTestRepository(sandbox.path).then(({ index }) => index))).toStrictEqual([path]);
    const session = await openSession(sandbox.path);
    expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
    const expected = runGitStep(sandbox.path, ['write-tree']);
    const source = kind === 'index' ? { kind } : { kind, hash: runGitStep(sandbox.path, ['rev-parse', 'HEAD']) };
    using copy = await copyRevision(sandbox.path, source);
    expect(copy.tree).toBe(expected);
    expect(runGitStep(copy.root, ['write-tree'])).toBe(expected);
    expect(await readdir(join(copy.root, path))).toStrictEqual([]);
    expect(await readFile(join(copy.root, 'source.txt'), 'utf8')).toBe(SELECTED_SOURCE);
    expect(listSubmodulePaths(await readTestRepository(copy.root).then(({ index }) => index))).toStrictEqual([path]);
    expect(await readFile(join(outside.path, 'package.json'), 'utf8')).toBe('{');
    expect(await readFile(join(outside.path, 'source.txt'), 'utf8')).toBe('outside source');
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
    const staged = runCommandBlocking(['git', 'add', 'nested/source.txt'], {
        cwd: worktree,
        env: { GIT_INDEX_FILE: index },
    });
    expect(staged.code, staged.stderr).toBe(0);
    await writeFile(join(worktree, 'nested/source.txt'), 'working\n');
    const report = join(sandbox.path, 'report.json');
    const timeout = String(SETTING_DEFINITIONS['tool_timeout_seconds'].default);
    const hooks = await writeProgramCommand(sandbox.path, 'hook/pre-commit', 'processes/revisions', timeout, report);
    const result = runCommandBlocking(['git', '-c', `core.hooksPath=${hooks}`, 'commit', '-qm', 'hook'], {
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

test('a revision copy keeps its source available until disposal and removes the temporary folder afterward', async () => {
    await using sandbox = await testdir({ 'source.txt': SELECTED_SOURCE });
    commitAll(sandbox.path);
    const copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copiedPath = join(copy.root, 'source.txt');
    expect(await readFile(copiedPath, 'utf8')).toBe(SELECTED_SOURCE);
    expect(runGitStep(copy.root, ['write-tree'])).toBe(copy.tree);
    copy[Symbol.dispose]();
    expect(await isOnDisk(copiedPath)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe(SELECTED_SOURCE);
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
    expect(runGitStep(copy.root, ['write-tree'])).toBe(copy.tree);
});
