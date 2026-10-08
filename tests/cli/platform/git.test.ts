import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';
import { chmod, copyFile, readFile, writeFile } from 'node:fs/promises';
import { GIT_HOOK_SCRIPT, GIT_HOOK_EXPECTED } from '#tests/config/cli/platform/git.ts';

test('a linked-worktree hook keeps its custom index and HEAD while checking private revisions', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'repository/nested/source.txt': 'committed\n' });
    const root = join(sandbox.path, 'repository');
    commitAll(root);
    const worktree = join(sandbox.path, 'linked');
    gitOutput(root, ['worktree', 'add', '-qb', 'hook-probe', worktree]);
    const directory = gitOutput(worktree, ['rev-parse', '--absolute-git-dir']);
    const index = join(directory, 'custom-index');
    const standard = await readFile(join(directory, 'index'));
    await copyFile(join(directory, 'index'), index);
    await writeFile(join(worktree, 'nested/source.txt'), 'selected\n');
    const staged = git(worktree, ['add', 'nested/source.txt'], { GIT_INDEX_FILE: index });
    expect(staged.code, staged.stderr).toBe(0);
    await writeFile(join(worktree, 'nested/source.txt'), 'working\n');
    await createFileTree(sandbox.path, {
        'hook/probe.mjs': GIT_HOOK_SCRIPT,
        'hook/pre-commit':
            '#!/bin/sh\n"$GSPOT_HOOK_RUNTIME" "$GSPOT_HOOK_PROBE" "$GSPOT_HOOK_REVISION" "$GSPOT_HOOK_GIT" "$GSPOT_HOOK_TOOL" "$GSPOT_HOOK_REPORT"\n',
    });
    await chmod(join(sandbox.path, 'hook/pre-commit'), 0o755);
    const revision = pathToFileURL(await Bun.resolve('#cli/execution/copy/public.ts', import.meta.dir)).href;
    const owner = pathToFileURL(await Bun.resolve('#cli/platform/git/public.ts', import.meta.dir)).href;
    const tool = pathToFileURL(await Bun.resolve('#cli/tools/contracts.ts', import.meta.dir)).href;
    const report = join(sandbox.path, 'report.json');
    const result = git(worktree, ['-c', `core.hooksPath=${join(sandbox.path, 'hook')}`, 'commit', '-qm', 'hook'], {
        GIT_INDEX_FILE: index,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'gspot.boundary',
        GIT_CONFIG_VALUE_0: 'inherited',
        GSPOT_HOOK_RUNTIME: process.execPath,
        GSPOT_HOOK_PROBE: join(sandbox.path, 'hook/probe.mjs'),
        GSPOT_HOOK_REVISION: revision,
        GSPOT_HOOK_GIT: owner,
        GSPOT_HOOK_TOOL: tool,
        GSPOT_HOOK_REPORT: report,
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(await readFile(report, 'utf8'))).toStrictEqual(GIT_HOOK_EXPECTED);
    expect(await readFile(join(directory, 'index'))).toEqual(standard);
    expect(gitOutput(worktree, ['symbolic-ref', 'HEAD'])).toBe('refs/heads/hook-probe');
    expect(await readFile(join(worktree, 'nested/source.txt'), 'utf8')).toBe('working\n');
});
