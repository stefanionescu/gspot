import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { openSession } from '#cli/session.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { type GitHookReport } from '#tests/types/processes.ts';
import { copyRevision } from '#cli/runs/scratch-copy/revision.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { readIndexEntries, listSubmodulePaths } from '#cli/repository/tracked.ts';
import { runGit, commitAll, readGitOutput, prepareNestedRepository } from '#tests/setup/git.ts';
import { listHeadEntries, listRevisionEntries } from '#cli/repository/revisions/tree-entries.ts';
import { chmod, mkdir, readdir, symlink, copyFile, readFile, writeFile } from 'node:fs/promises';
import { GIT_HOOK_CASES, GIT_HOOK_FIELDS, GIT_HOOK_REPORT, GIT_HOOK_SCRIPT } from '#tests/data/runs/scratch-copies.ts';

test('a revision copy of a nested gspot.toml keeps the repository around it', async () => {
    await using sandbox = await testdir();
    const { project, commitId } = await prepareNestedRepository(sandbox.path);
    const headEntries = await listHeadEntries(project);
    expect(headEntries.map((entry) => entry.path)).toStrictEqual(['source.txt']);
    const entries = await listRevisionEntries(project, { kind: 'index' });
    expect(entries.map((entry) => entry.path)).toStrictEqual(['source.txt']);
    for (const source of [{ kind: 'index' } as const, { kind: 'commit', hash: commitId } as const]) {
        await copyRevision(project, source, async (copy, tree) => {
            expect(await Bun.file(join(copy, 'source.txt')).text()).toBe(
                source.kind === 'index' ? 'indexed' : 'pushed',
            );
            expect(await Bun.file(join(copy, '..', 'outside.txt')).text()).toBe('changed context');
            expect(readGitOutput(copy, ['write-tree'])).toBe(tree);
        });
    }
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('working');
});

test.each(['index', 'commit'] as const)('a %s copy keeps gitlinks without reading submodule contents', async (kind) => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([]),
        'source.txt': 'selected source',
    });
    await createFileTree(outside.path, { 'package.json': '{', 'source.txt': 'outside source' });
    readGitOutput(sandbox.path, ['init']);
    readGitOutput(sandbox.path, ['add', '.']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'Source']);
    const commitId = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const path = 'vendor/external project';
    readGitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `160000,${commitId},${path}`]);
    readGitOutput(sandbox.path, ['commit', '-qm', 'Gitlink']);
    await mkdir(join(sandbox.path, 'vendor'));
    await symlink(outside.path, join(sandbox.path, path), 'dir');
    expect(listSubmodulePaths(await readIndexEntries(sandbox.path))).toStrictEqual([path]);
    const session = await openSession(sandbox.path);
    expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
    const expected = readGitOutput(sandbox.path, ['write-tree']);
    const source = kind === 'index' ? { kind } : { kind, hash: readGitOutput(sandbox.path, ['rev-parse', 'HEAD']) };
    await copyRevision(sandbox.path, source, async (copy, tree) => {
        expect(tree).toBe(expected);
        expect(readGitOutput(copy, ['write-tree'])).toBe(expected);
        expect(await readdir(join(copy, path))).toStrictEqual([]);
        expect(await Bun.file(join(copy, 'source.txt')).text()).toBe('selected source');
        expect(listSubmodulePaths(await readIndexEntries(copy))).toStrictEqual([path]);
    });
    expect(await Bun.file(join(outside.path, 'package.json')).text()).toBe('{');
    expect(await Bun.file(join(outside.path, 'source.txt')).text()).toBe('outside source');
});

// Run the hook with the real module entry points and the inherited Git environment.
async function runGitHook(worktree: string, index: string, folder: string, report: string) {
    const revision = pathToFileURL(await Bun.resolve('#cli/runs/scratch-copy/revision.ts', import.meta.dir)).href;
    const owner = pathToFileURL(await Bun.resolve('#cli/system/git.ts', import.meta.dir)).href;
    const tool = pathToFileURL(await Bun.resolve('#cli/tools/run.ts', import.meta.dir)).href;
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
        GSPOT_HOOK_TIMEOUT: String(SETTING_DEFAULTS.tool_timeout_seconds),
        GSPOT_HOOK_REPORT: report,
    });
}

test.each([...GIT_HOOK_CASES])(
    'the $part command preserves the owner index and working tree: $name',
    async ({ part }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'repository/nested/source.txt': 'committed\n' });
        const root = join(sandbox.path, 'repository');
        commitAll(root);
        const worktree = join(sandbox.path, 'linked');
        readGitOutput(root, ['worktree', 'add', '-qb', 'hook-probe', worktree]);
        const folder = readGitOutput(worktree, ['rev-parse', '--absolute-git-dir']);
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
        const result = await runGitHook(worktree, index, sandbox.path, report);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const actual = JSON.parse(await readFile(report, 'utf8')) as GitHookReport;
        if (part === 'HEAD') {
            expect(actual.headRetained).toBe(GIT_HOOK_REPORT.headRetained);
            expect(actual.workingBytes).toBe(GIT_HOOK_REPORT.workingBytes);
            expect(readGitOutput(worktree, ['symbolic-ref', 'HEAD'])).toBe('refs/heads/hook-probe');
            expect(await readFile(join(worktree, 'nested/source.txt'), 'utf8')).toBe('working\n');
        } else {
            const fields = GIT_HOOK_FIELDS[part];
            expect(
                actual.reports.map((entry: Record<string, unknown>) =>
                    Object.fromEntries(fields.map((field) => [field, entry[field]])),
                ),
            ).toStrictEqual(
                GIT_HOOK_REPORT.reports.map((entry) =>
                    Object.fromEntries(fields.map((field) => [field, entry[field]])),
                ),
            );
            if (part === 'index') {
                expect(actual.indexRetained).toBe(GIT_HOOK_REPORT.indexRetained);
                expect(await readFile(join(folder, 'index'))).toEqual(standard);
            }
        }
    },
);

// Windows filenames cannot contain a newline or a double quote.
test.skipIf(isWindows)('an index copy keeps unusual filename bytes and contents', async () => {
    await using sandbox = await testdir();
    const path = 'a\n"é.sql';
    await createFileTree(sandbox.path, { [path]: 'select 1;\n' });
    commitAll(sandbox.path);
    await copyRevision(sandbox.path, { kind: 'index' }, async (scratch) => {
        expect(await Bun.file(join(scratch, path)).text()).toBe('select 1;\n');
    });
});
