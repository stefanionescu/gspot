import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { buildGitignoreMatcher, listGitignorePatterns } from '#cli/repository/files/gitignore.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('a path outside the repository is not ignored, and a path that .gitignore names is', async () => {
    await using sandbox = await testdir({ '.gitignore': 'dist/\n' });

    const isIgnored = buildGitignoreMatcher(createRunCache(sandbox.path), ['.gitignore']);
    expect(['..', '../', 'dist/index.html', 'src/index.ts'].map((path) => isIgnored(path))).toStrictEqual([
        false,
        false,
        true,
        false,
    ]);
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

test('the tracked .gitignore patterns leave out the block that gspot manages, which an install can rewrite', async () => {
    await using sandbox = await testdir({
        '.gitignore': 'dist/\n\n# >>> gspot managed >>>\n.gspot/node_modules/\n# <<< gspot managed <<<\n*.log\n',
    });

    expect(listGitignorePatterns(createRunCache(sandbox.path), ['.gitignore'])).toStrictEqual(['dist/', '*.log']);
});

test('a tracked .gitignore that is missing from the working tree is refused, not read as empty', async () => {
    await using sandbox = await testdir({ '.gitignore': 'dist/\n' });

    expect(() => listGitignorePatterns(createRunCache(sandbox.path), ['.gitignore', 'app/.gitignore'])).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: expect.stringContaining('app/.gitignore') as string,
        }),
    );
});
