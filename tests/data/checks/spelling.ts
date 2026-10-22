import { BASE_INSTALLED_FILES } from '#tests/data/setup/sandboxes.ts';

/** The paths that each spelling exclusion leaves checked. Both generated tool files must report them. */
export const SPELLING_IGNORE_CASES = [
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
        patterns: ['nested/src/'],
        expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/child/src/bad.txt', 'nested/trc/bad.txt'],
    },
    { patterns: ['nested'], expected: [] },
    { patterns: ['**/nested/**/src/*'], expected: ['nested/bad.txt', 'nested/child/bad.txt', 'nested/trc/bad.txt'] },
] as const;

/**
 * Deliberate misspellings for the spelling tests. The typos check leaves this one file out, so every test file stays
 * checked, and the check reports a real typo in a test.
 */
export const TYPO = {
    the: 'teh',
    color: 'colour',
    receive: 'recieve',
    whether: 'wether',
    word: 'wrod',
    spelling: 'speling',
    select: 'SELEC',
} as const;

export const SPELLING_SANDBOX = {
    install: false,
    configurations: ['spelling'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export const SPELLING_CHECK_ARGUMENTS = ['check', '--only', 'spelling/typos', '--json'] as const;

/** Settings with a root and a scope spelling locale. */
export const SPELLING_LOCALE_SETTINGS = {
    level: 'all',
    tables: `[spelling]
locale = "en-us"
[[scope]]
path = "british"
[scope.spelling]
locale = "en-gb"
[[scope]]
path = "british/child"
`,
} as const;
