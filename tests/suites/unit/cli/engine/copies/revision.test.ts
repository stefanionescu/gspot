import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, readlink, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { copyRevision } from '#cli/engine/copies/revision.ts';
import { openSession } from '#cli/engine/session.ts';
import { listSubmodulePaths } from '#cli/repository/files/tracked.ts';
import { listRevisionFiles, readHead } from '#cli/repository/revisions/files.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { GIT_HOOK_REPORT, SELECTED_SOURCE } from '#tests/config/engine/files.ts';
import { LOWERCASE_SELECT_SQL } from '#tests/config/engine/tool-runs.ts';
import { CHANGED_CONTEXT } from '#tests/config/setup/sandboxes.ts';
import { readTestRepository } from '#tests/setup/cli/repository.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { prepareNestedRepository } from '#tests/setup/sandboxes/repositories.ts';
import { overrideEnvironment } from '#tests/setup/system/environment.ts';
import { writeProgramCommand } from '#tests/setup/system/fakes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';

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
    const { index } = await readTestRepository(sandbox.path);
    expect(listSubmodulePaths(index)).toStrictEqual([path]);
    const session = await openSession(sandbox.path);
    expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
    const expected = runGitStep(sandbox.path, ['write-tree']);
    const source = kind === 'index' ? { kind } : { kind, hash: runGitStep(sandbox.path, ['rev-parse', 'HEAD']) };
    using copy = await copyRevision(sandbox.path, source);
    expect(copy.tree).toBe(expected);
    expect(await readdir(join(copy.root, path))).toStrictEqual([]);
    expect(await readFile(join(copy.root, 'source.txt'), 'utf8')).toBe(SELECTED_SOURCE);
    const copied = await readTestRepository(copy.root);
    expect(listSubmodulePaths(copied.index)).toStrictEqual([path]);
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

test('a copy with checked paths clones the ignored declarations of only the tsconfig files whose folder holds one', async () => {
    await using sandbox = await testdir({
        '.gitignore': '*.gen.d.ts\n',
        'site/tsconfig.json': '{"include":["src/**/*.ts","types.gen.d.ts"]}',
        'site/types.gen.d.ts': 'declare const site: string;\n',
        'site/src/page.ts': 'export const page = 1;\n',
        'tools/tsconfig.json': '{"include":["src/**/*.ts","types.gen.d.ts"]}',
        'tools/types.gen.d.ts': 'declare const tools: string;\n',
        'tools/src/main.ts': 'export const main = 1;\n',
    });
    commitAll(sandbox.path);
    using checked = await copyRevision(sandbox.path, { kind: 'index', paths: ['site/src/page.ts'] });
    expect(existsSync(join(checked.root, 'site/types.gen.d.ts'))).toBe(true);
    expect(existsSync(join(checked.root, 'tools/types.gen.d.ts'))).toBe(false);
    using every = await copyRevision(sandbox.path, { kind: 'index' });
    expect(existsSync(join(every.root, 'tools/types.gen.d.ts'))).toBe(true);
});
