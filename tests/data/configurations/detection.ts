/** Swift sources, and whether each one counts as test code; comments and strings do not. */
export const SWIFT_TEST_SAMPLES = [
    { name: 'XCTest import', source: 'import XCTest\n', selected: true },
    { name: 'qualified Testing attribute', source: '@Testing.Test func checks() {}\n', selected: true },
    { name: 'comment and string examples', source: '// import Testing\nlet example = "@Test"\n', selected: false },
    { name: 'TestingSupport import', source: 'import TestingSupport\n', selected: false },
] as const;

/** Only the executable package target declares Swift tests. */
export const SWIFT_TARGET_CASES = [
    {
        name: 'an executable test target',
        source: `import PackageDescription
let package = Package(name: "App", targets: [.testTarget(name: "Checks")])
`,
        declared: true,
    },
    {
        name: 'a comment and a string',
        source: '// .testTarget(name: "Checks")\nlet example = ".testTarget"\n',
        declared: false,
    },
] as const;

/** Only a real provider line in the Prisma schema of the scope marks a project as Postgres. */
export const PRISMA_CONTENT_CASES = [
    {
        name: 'Postgres provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "postgresql"
}
`,
        detected: true,
    },
    {
        name: 'SQLite provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "sqlite"
}
`,
        detected: false,
    },
    {
        name: 'MySQL provider',
        path: 'prisma/schema.prisma',
        source: `datasource db {
  provider = "mysql"
}
`,
        detected: false,
    },
    {
        name: 'a commented provider',
        path: 'prisma/schema.prisma',
        source: '// provider = "postgresql"\n',
        detected: false,
    },
    { name: 'an unrelated text file', path: 'notes.txt', source: 'provider = "postgresql"\n', detected: false },
    { name: 'migrations without a provider', path: 'migrations/1_initial.sql', source: 'SELECT 1;\n', detected: false },
] as const;

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

/** The nearest configuration choices apply to child folders, and siblings stay apart. */
export const PROJECT_CHOICES = {
    configurations: ['nextjs', 'javascript'],
    removed_configurations: [],
    scope: [
        { path: 'app', configurations: [], removed_configurations: ['nextjs'] },
        { path: 'app/worker', configurations: ['nextjs'], removed_configurations: [] },
        { path: 'required', configurations: [], removed_configurations: ['javascript'] },
    ],
} as const;

/** Inheritance from the root, removal, restoring in a deeper scope, separate siblings, and required dependencies. */
export const PROJECT_SELECTIONS = [
    ['', 'nextjs', true],
    ['app', 'nextjs', false],
    ['app/child', 'nextjs', false],
    ['app/worker', 'nextjs', true],
    ['sibling', 'nextjs', true],
    ['required', 'javascript', true],
] as const;

export const SITE_DETECTION_PATHS = [
    'site.webmanifest',
    'sitemap.xml',
    'public/site.webmanifest',
    'public/sitemap.xml',
    'docs/public/sitemap.xml',
    'static/site.webmanifest',
] as const;
