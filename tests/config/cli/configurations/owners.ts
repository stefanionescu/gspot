/** Formats claimed by no file reader. */
export const UNSUPPORTED_CONFIGURATION_FILES = [
    'settings.ini',
    'settings.cfg',
    'settings.properties',
    'app.webmanifest',
    '.nvmrc',
    '.node-version',
    '.python-version',
];

export const SCOPE_OWNER_PATHS = [
    'migrations/V1_root.sql',
    'app/migrations/V2_first.sql',
    'other/migrations/V3_other.sql',
];

export const PATH_OWNER_CASES = [
    ['', ['migrations/V1_root.sql']],
    ['app', ['app/migrations/V2_first.sql']],
    ['other', ['other/migrations/V3_other.sql']],
] as const;

export const TEST_FILE_OWNER_PATHS = [
    'qa/root.js',
    'jest.config.js',
    'src/ordinary.js',
    'app/qa/child.js',
    'app/verification/read.js',
    'app/jest.config.js',
    'app/deep/qa/read.js',
    'sibling/qa/read.js',
];

export const TEST_FILE_OWNER_CASES = [
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
];

export const FILE_PATH_REFERENCES = [
    { path: '{setting:test_files}', accepted: true },
    { path: '**/*.{test,spec}.ts', accepted: true },
    { path: 'src/{setting:test_files}', accepted: false },
    { path: '{setting:missing}', accepted: false },
    { path: '{setting:test_files}/suffix', accepted: false },
];
