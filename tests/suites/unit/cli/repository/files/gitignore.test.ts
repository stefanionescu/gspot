import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildGitignoreTest } from '#cli/repository/files/gitignore.ts';

test('a path outside the repository is not ignored, and a path that .gitignore names is', async () => {
    await using sandbox = await testdir({ '.gitignore': 'dist/\n' });

    const isIgnored = buildGitignoreTest(createReadCache(sandbox.path), ['.gitignore']);
    expect(
        ['..', '../', '../README.md', 'dist/index.html', 'src/index.ts'].map((path) => isIgnored(path)),
    ).toStrictEqual([false, false, false, true, false]);
});
