import { expect, test } from 'bun:test';
import { scopeIgnorePatterns } from '#cli/generation/ignore-patterns.ts';

test.each([
    { pattern: '/{apps,packages}/web/file.ts', expected: ['/file.ts'] },
    { pattern: '/{apps,{services,packages}}/web/file.ts', expected: ['/file.ts'] },
    { pattern: String.raw`/apps/web/{a\,b,c}.ts`, expected: [String.raw`/a\,b.ts`, '/c.ts'] },
    { pattern: '/apps/web/[{},].ts', expected: ['/[{},].ts'] },
    { pattern: '/apps/web/[{a,b}.ts', expected: ['/[{a,b}.ts'] },
    { pattern: String.raw`/apps/web/[a\]{b,c}]`, expected: [String.raw`/[a\]{b,c}]`] },
    { pattern: '/apps/web/[{a,b}\\', expected: ['/[{a,b}\\'] },
    { pattern: String.raw`/apps/web/\{a,b}.ts`, expected: [String.raw`/\{a,b}.ts`] },
    { pattern: '/apps/web/}{a,b}.ts', expected: ['/}a.ts', '/}b.ts'] },
    { pattern: '/apps/web/{a,a}.ts', expected: ['/a.ts'] },
])('scope projection preserves brace and escape semantics for $pattern', ({ pattern, expected }) => {
    expect(scopeIgnorePatterns([pattern], 'apps/web')).toStrictEqual([...expected]);
});

test('scope projection preserves exclusion order and nested scope isolation', () => {
    expect(scopeIgnorePatterns(['/apps/web/{a,b}.ts', '!/apps/web/a.ts'], 'apps/web')).toStrictEqual([
        '/a.ts',
        '/b.ts',
        '!/a.ts',
    ]);
    expect(scopeIgnorePatterns(['/{apps,packages}/web/file.ts'], 'services/web')).toStrictEqual([]);
    expect(scopeIgnorePatterns(['# comment', '', '**/generated/'], '')).toStrictEqual([
        '# comment',
        '',
        '**/generated/',
    ]);
});
