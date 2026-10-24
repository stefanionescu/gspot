import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { changeSandbox } from '#tests/setup/sandboxes/changes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readCheckoutCacheFolder } from '#cli/checks/language/swift/cache.ts';

test.each(['staged', 'committed'])('sandbox disposal removes files %s after the sample starts', async (state) => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'original.txt': 'saved\n' });
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

test('sandbox disposal restores files without Git', async () => {
    await using sandbox = await testdir({ 'gspot.toml': 'configurations = []\n', 'original.txt': 'saved\n' });
    await using sample = new AsyncDisposableStack();
    sample.use(
        await changeSandbox(
            { root: sandbox.path, run: runGspot },
            { files: { 'generated.txt': 'temporary\n', 'original.txt': 'modified\n' } },
        ),
    );
    await sample.disposeAsync();
    expect(await isOnDisk(join(sandbox.path, 'generated.txt'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'original.txt'), 'utf8')).toBe('saved\n');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe('configurations = []\n');
});

test('sandbox disposal removes the build cache owned by its checkout', async () => {
    await using _cache = await redirectCacheFolder();
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await createSandbox({ configurations: [], files: { 'source.txt': 'source\n' } }));
    const folder = readCheckoutCacheFolder(sandbox.root);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'build-output'), 'build\n');
    await resources.disposeAsync();
    expect(await isOnDisk(folder)).toBe(false);
});
