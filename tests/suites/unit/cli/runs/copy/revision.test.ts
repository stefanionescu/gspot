import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { type ProcessOutput } from '#tests/types/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readHead, listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { prepareNestedRepository } from '#tests/setup/sandboxes/repositories.ts';
import { readIndexFiles, listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { GIT_HOOK_REPORT, GIT_HOOK_SCRIPT } from '#tests/config/runs/copy/revision.ts';
import { chmod, mkdir, readdir, symlink, copyFile, readFile, writeFile } from 'node:fs/promises';

function runGitHook(worktree: string, index: string, folder: string, report: string): ProcessOutput {
    const revision = pathToFileURL(Bun.resolveSync('#cli/runs/copy/revision.ts', import.meta.dir)).href;
    const owner = pathToFileURL(Bun.resolveSync('#cli/system/git.ts', import.meta.dir)).href;
    const tool = pathToFileURL(Bun.resolveSync('#cli/tools/run.ts', import.meta.dir)).href;
    return runGit(worktree, ['-c', `core.hooksPath=${join(folder, 'hook')}`, 'commit', '-qm', 'hook'], {
        GIT_INDEX_FILE: index,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'gspot.boundary',
        GIT_CONFIG_VALUE_0: 'inherited',
        GSPOT_HOOK_RUNTIME: process.execPath,
        GSPOT_HOOK_PROBE: join(folder, 'hook/probe.mjs'),
        GSPOT_HOOK_REVISION: revision,
        GSPOT_HOOK_GIT: owner,
        GSPOT_HOOK_TOOL: tool,
        GSPOT_HOOK_TIMEOUT: String(SETTING_DEFINITIONS['tool_timeout_seconds'].default),
        GSPOT_HOOK_REPORT: report,
    });
}

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
        expect(await readFile(join(copy.root, '..', 'outside.txt'), 'utf8')).toBe('changed context');
        expect(runGitStep(copy.root, ['write-tree'])).toBe(copy.tree);
    }
    expect(await readFile(join(project, 'source.txt'), 'utf8')).toBe('working');
});

test.each(['index', 'commit'] as const)('a %s copy keeps gitlinks without reading submodule contents', async (kind) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([]),
        'source.txt': 'selected source',
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
    expect(listSubmodulePaths(await readIndexFiles(sandbox.path))).toStrictEqual([path]);
    const session = await openSession(sandbox.path);
    expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
    const expected = runGitStep(sandbox.path, ['write-tree']);
    const source = kind === 'index' ? { kind } : { kind, hash: runGitStep(sandbox.path, ['rev-parse', 'HEAD']) };
    using copy = await copyRevision(sandbox.path, source);
    expect(copy.tree).toBe(expected);
    expect(runGitStep(copy.root, ['write-tree'])).toBe(expected);
    expect(await readdir(join(copy.root, path))).toStrictEqual([]);
    expect(await readFile(join(copy.root, 'source.txt'), 'utf8')).toBe('selected source');
    expect(listSubmodulePaths(await readIndexFiles(copy.root))).toStrictEqual([path]);
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
    const staged = runGit(worktree, ['add', 'nested/source.txt'], { GIT_INDEX_FILE: index });
    expect(staged.code, staged.stderr).toBe(0);
    await writeFile(join(worktree, 'nested/source.txt'), 'working\n');
    await createFileTree(sandbox.path, {
        'hook/probe.mjs': GIT_HOOK_SCRIPT,
        'hook/pre-commit':
            '#!/bin/sh\n"$GSPOT_HOOK_RUNTIME" "$GSPOT_HOOK_PROBE" "$GSPOT_HOOK_REVISION" "$GSPOT_HOOK_GIT" "$GSPOT_HOOK_TOOL" "$GSPOT_HOOK_TIMEOUT" "$GSPOT_HOOK_REPORT"\n',
    });
    await chmod(join(sandbox.path, 'hook/pre-commit'), 0o755);
    const report = join(sandbox.path, 'report.json');
    const result = runGitHook(worktree, index, sandbox.path, report);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(await readFile(report, 'utf8'))).toStrictEqual(GIT_HOOK_REPORT);
    expect(runGitStep(worktree, ['symbolic-ref', 'HEAD'])).toBe('refs/heads/hook-probe');
    expect(await readFile(join(worktree, 'nested/source.txt'), 'utf8')).toBe('working\n');
    expect(await readFile(join(folder, 'index'))).toStrictEqual(standard);
});

test.skipIf(isWindows)('an index copy keeps unusual filename bytes and contents', async () => {
    await using sandbox = await testdir();
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    commitAll(sandbox.path);
    using copy = await copyRevision(sandbox.path, { kind: 'index' });
    expect(await readFile(join(copy.root, path), 'utf8')).toBe('select 1;\n');
});

test('a revision copy keeps its source available until disposal and removes the temporary folder afterward', async () => {
    await using sandbox = await testdir({ 'source.txt': 'selected source' });
    commitAll(sandbox.path);
    const copy = await copyRevision(sandbox.path, { kind: 'index' });
    const copiedPath = join(copy.root, 'source.txt');
    expect(await readFile(copiedPath, 'utf8')).toBe('selected source');
    expect(runGitStep(copy.root, ['write-tree'])).toBe(copy.tree);
    copy[Symbol.dispose]();
    expect(await isOnDisk(copiedPath)).toBe(false);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('selected source');
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
