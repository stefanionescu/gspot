import { test, expect } from 'bun:test';
import { formatFixes } from '#cli/commands/check/fixes.ts';

test('the fix report names the conflicted and the broken files', () => {
    expect(formatFixes({ results: [], changed: [], broken: ['broken.ts'], conflicted: ['merge.ts'] })).toStrictEqual([
        'The fixers left a syntax error in broken.ts; gspot put back the file as it was before the fixers.',
        'The fixers skipped merge.ts, because it holds merge-conflict markers.',
    ]);
});
