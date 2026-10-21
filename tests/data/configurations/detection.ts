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

export const SITE_DETECTION_PATHS = [
    'site.webmanifest',
    'sitemap.xml',
    'public/site.webmanifest',
    'public/sitemap.xml',
    'docs/public/sitemap.xml',
    'static/site.webmanifest',
] as const;
