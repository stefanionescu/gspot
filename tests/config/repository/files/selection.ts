export const MIGRATION_CASES = [
    ['', ['migrations/V1_root.sql']],
    ['app', ['app/migrations/V2_first.sql']],
    ['other', ['other/migrations/V3_other.sql']],
] as const;

export const JEST_PATHS = [
    'qa/root.js',
    'jest.config.js',
    'src/ordinary.js',
    'app/qa/child.js',
    'app/verification/read.js',
    'app/jest.config.js',
    'app/deep/qa/read.js',
    'sibling/qa/read.js',
] as const;

export const JEST_CASES = [
    { scope: '', tests: ['qa/**'], expected: ['qa/root.js', 'jest.config.js', 'app/jest.config.js'] },
    {
        scope: 'app',
        tests: ['**/qa/**', 'app/verification/**'],
        expected: ['app/qa/child.js', 'app/verification/read.js', 'app/jest.config.js', 'app/deep/qa/read.js'],
    },
    { scope: 'app/deep', tests: ['**/qa/**', 'app/verification/**'], expected: ['app/deep/qa/read.js'] },
    { scope: 'sibling', tests: ['**/qa/**'], expected: ['sibling/qa/read.js'] },
    { scope: '', tests: [], expected: ['jest.config.js', 'app/jest.config.js'] },
    { scope: 'app', tests: [], expected: ['app/jest.config.js'] },
] as const;

export const PRETTIER_PLUGIN_CASES = [
    [['format', 'typescript'], ['src/index.ts']],
    [
        ['format', 'typescript', 'astro'],
        ['src/Page.astro', 'src/index.ts'],
    ],
    [
        ['format', 'typescript', 'svelte'],
        ['src/App.svelte', 'src/index.ts'],
    ],
] as const;
