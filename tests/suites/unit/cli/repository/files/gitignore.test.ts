import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createRunCache } from '#cli/system/cache.ts';
import { listGitignorePatterns, buildGitignoreMatcher } from '#cli/repository/files/gitignore.ts';

test('a path outside the repository is not ignored, and a path that .gitignore names is', async () => {
    await using sandbox = await testdir({ '.gitignore': 'dist/\n' });

    const isIgnored = buildGitignoreMatcher(createRunCache(sandbox.path), ['.gitignore']);
    expect(
        ['..', '../', '../README.md', 'dist/index.html', 'src/index.ts'].map((path) => isIgnored(path)),
    ).toStrictEqual([false, false, false, true, false]);
});

test('the tracked .gitignore patterns are anchored at their folders, without negations or tracked matches', async () => {
    await using sandbox = await testdir({
        '.gitignore': 'other/\n# A comment\n\n!keep.log\n*.log\n.env*\n/out\n',
        'app/.gitignore': 'cache/\n/generated/types\n',
        '.gspot/.gitignore': 'node_modules/\n',
    });

    const tracked = ['.gitignore', 'app/.gitignore', '.gspot/.gitignore', '.env.example', 'app/main.py'];
    expect(listGitignorePatterns(createRunCache(sandbox.path), tracked)).toStrictEqual([
        'other/',
        '*.log',
        '/out',
        '/app/**/cache/',
        '/app/generated/types',
    ]);
});
