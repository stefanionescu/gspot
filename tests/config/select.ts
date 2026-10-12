export const MIGRATION_PATHS = [
    'migrations/V1_root.sql',
    'app/migrations/V2_first.sql',
    'other/migrations/V3_other.sql',
] as const;

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

/** Nearest manual configuration choices apply to descendants, with sibling isolation. */
export const PROJECT_CHOICES = {
    configurations: ['nextjs', 'javascript'],
    removed_configurations: [],
    scope: [
        { path: 'app', configurations: [], removed_configurations: ['nextjs'] },
        { path: 'app/worker', configurations: ['nextjs'], removed_configurations: [] },
        { path: 'required', configurations: [], removed_configurations: ['javascript'] },
    ],
} as const;

/** Root inheritance, removal, deeper restoration, sibling independence, and required dependencies. */
export const PROJECT_SELECTIONS = [
    ['', 'nextjs', true],
    ['app', 'nextjs', false],
    ['app/child', 'nextjs', false],
    ['app/worker', 'nextjs', true],
    ['sibling', 'nextjs', true],
    ['required', 'javascript', true],
] as const;
