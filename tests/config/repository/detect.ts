export const PRISMA_SCHEMA_CASES = [
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
        name: 'a commented provider',
        path: 'prisma/schema.prisma',
        source: '// provider = "postgresql"\n',
        detected: false,
    },
    { name: 'an unrelated text file', path: 'notes.txt', source: 'provider = "postgresql"\n', detected: false },
] as const;

export const RUNTIME_DETECTION_CASES = [
    ...(['node'] as const).flatMap((runtime) =>
        [
            { name: `${runtime} engine`, package: { engines: { [runtime]: '>=1' } }, source: '', detected: true },
            {
                name: `${runtime} script`,
                package: { scripts: { start: `${runtime} run entry.js` } },
                source: '',
                detected: true,
            },
            {
                name: `${runtime} shebang`,
                package: {},
                source: `#!/usr/bin/env ${runtime}\nconsole.log(1);\n`,
                detected: true,
            },
            {
                name: `${runtime} quoted script text`,
                package: { scripts: { start: `echo "${runtime} entry.js"` } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} type dependency`,
                package: { devDependencies: { [`@types/${runtime}`]: '1.0.0' } },
                source: '',
                detected: false,
            },
            {
                name: `${runtime} tool-project manifest`,
                package: {},
                source: '',
                toolProjectPackageJson: { engines: { [runtime]: '>=1' } },
                detected: false,
            },
        ].map((row) => ({ ...row, runtime })),
    ),
    {
        name: 'JavaScript without a declared runtime',
        runtime: 'node',
        package: {},
        source: 'console.log(1);\n',
        detected: false,
    },
];

export const CONFIGURATION_EVIDENCE_CASES = [
    {
        name: 'Starlight without sitemap files',
        files: { 'package.json': '{"dependencies":{"@astrojs/starlight":"0.0.0-test"}}' },
        configuration: 'site',
        selected: true,
    },
    {
        name: 'a Django sitemap template',
        files: { 'requirements.txt': 'django==0.0.0\n', 'templates/sitemap.xml': '<urlset />\n' },
        configuration: 'site',
        selected: false,
    },
    {
        name: 'tRPC client without server',
        files: { 'package.json': '{"dependencies":{"@trpc/client":"0.0.0-test"}}' },
        configuration: 'trpc',
        selected: true,
    },
    {
        name: 'a Vitest configuration without dependencies',
        files: { 'vitest.config.ts': 'export default {};\n' },
        configuration: 'vitest',
        selected: true,
    },
    {
        name: 'a Swagger YAML document',
        files: { 'swagger.yml': 'openapi: 3.1.0\n' },
        configuration: 'openapi',
        selected: true,
    },
] as const;
