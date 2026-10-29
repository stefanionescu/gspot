import { testdir } from 'testdirs';
import { sep, join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CONFIGURATIONS_SETTINGS } from '#tests/config/toml.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { readRepositoryCacheFolder } from '#cli/checks/language/swift/cache.ts';

test.each(['staged', 'committed'])('sandbox disposal removes files %s after the sample starts', async (state) => {
    await using sandbox = await testdir({ 'gspot.toml': CONFIGURATIONS_SETTINGS, 'original.txt': 'saved\n' });
    const head = commitAll(sandbox.path);
    await using sample = new AsyncDisposableStack();
    sample.use(await changeSandbox({ root: sandbox.path, run: runGspot }, { files: { 'original.txt': 'modified\n' } }));
    await writeFile(join(sandbox.path, 'generated.txt'), 'temporary\n');
    runGitStep(sandbox.path, ['add', '--all']);
    if (state === 'committed') runGitStep(sandbox.path, ['commit', '-qm', 'Temporary sample']);
    await sample.disposeAsync();
    expect(await isOnDisk(join(sandbox.path, 'generated.txt'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'original.txt'), 'utf8')).toBe('saved\n');
    expect(runGitStep(sandbox.path, ['status', '--porcelain'])).toBe('');
    expect(runGitStep(sandbox.path, ['rev-parse', 'HEAD'])).toBe(head);
});

test.each(['staged', 'committed'])('sandbox disposal restores an unborn repository after %s changes', async (state) => {
    await using sandbox = await testdir({ 'gspot.toml': CONFIGURATIONS_SETTINGS, 'original.txt': 'saved\n' });
    runGitStep(sandbox.path, ['init', '-q']);
    await using sample = new AsyncDisposableStack();
    sample.use(
        await changeSandbox(
            { root: sandbox.path, run: runGspot },
            {
                files: { 'generated.txt': 'temporary\n', 'original.txt': 'modified\n' },
            },
        ),
    );
    runGitStep(sandbox.path, ['add', '-A']);
    if (state === 'committed') runGitStep(sandbox.path, ['commit', '-qm', 'Temporary sample']);
    await sample.disposeAsync();
    expect(await isOnDisk(join(sandbox.path, 'generated.txt'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'original.txt'), 'utf8')).toBe('saved\n');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(CONFIGURATIONS_SETTINGS);
    expect(runGitStep(sandbox.path, ['ls-files'])).toBe('');
    expect(runCommandBlocking(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} }).code).toBe(128);
});

test('a sandbox keeps its build cache in the run folder', async () => {
    await using sandbox = await createSandbox({ configurations: [], files: { 'source.txt': 'source\n' } });
    const cache = readEnvironmentVariable('XDG_CACHE_HOME');
    expect(cache).toBeDefined();
    const folder = readRepositoryCacheFolder(sandbox.root);
    expect(folder.startsWith(`${cache!}${sep}`)).toBe(true);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'build-output'), 'build\n');
    expect(await readFile(join(folder, 'build-output'), 'utf8')).toBe('build\n');
});

test('sandbox disposal restores staged and untracked files and removes new ignored files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': CONFIGURATIONS_SETTINGS,
        '.gitignore': 'ignored/\n',
        'source.txt': 'committed\n',
        ignored: { 'saved.txt': 'saved ignored file\n' },
    });
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'staged\n');
    runGitStep(sandbox.path, ['add', 'source.txt']);
    await writeFile(join(sandbox.path, 'source.txt'), 'working\n');
    await writeFile(join(sandbox.path, 'untracked.txt'), 'untracked\n');
    const index = runGitStep(sandbox.path, ['write-tree']);
    await using sample = new AsyncDisposableStack();
    sample.use(
        await changeSandbox(
            { root: sandbox.path, run: runGspot },
            {
                files: { 'source.txt': 'modified\n', 'ignored/new.txt': 'new ignored file\n' },
                removed: ['untracked.txt'],
            },
        ),
    );
    await writeFile(join(sandbox.path, 'generated.txt'), 'generated\n');
    await sample.disposeAsync();
    expect(runGitStep(sandbox.path, ['write-tree'])).toBe(index);
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('working\n');
    expect(await readFile(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('untracked\n');
    expect(await readFile(join(sandbox.path, 'ignored/saved.txt'), 'utf8')).toBe('saved ignored file\n');
    expect(await isOnDisk(join(sandbox.path, 'ignored/new.txt'))).toBe(false);
    expect(await isOnDisk(join(sandbox.path, 'generated.txt'))).toBe(false);
});
