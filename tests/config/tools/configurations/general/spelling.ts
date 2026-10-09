/** Exact surviving paths for each declared spelling exclusion. both emitted configurations must report them. */
export const SPELLING_EXCLUSIONS = [
    {
        patterns: ['nested/src/**'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    { patterns: ['**/src/**'], expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/trc/bad.txt'] },
    { patterns: ['*.txt', '!**/keep.txt'], expected: ['nested/src/keep.txt'] },
    {
        patterns: ['{nested/src,other/lib}/**'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    {
        patterns: ['nested/[st]rc/**'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt'],
    },
    {
        patterns: ['/nested/src/'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    { patterns: ['nested'], expected: [] },
    { patterns: ['**/nested/**/src/*'], expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/trc/bad.txt'] },
];
