import { GSPOT_PATHS } from '#cli/config/manifests.ts';

export const PACKAGE_FIELDS = {
    name: 'example-package',
    dependencies: { next: '16.0.0' },
    'simple-git-hooks': null,
    customSettings: { enabled: true },
} as const;

export const PROJECT_DEPENDENCY_FILES = {
    'package.json': '{"dependencies":{"@nestjs/swagger":"11.2.3"}}',
    'app/package.json': '{"devDependencies":{"tailwindcss":"4.1.13"}}',
    'other/package.json': '{"dependencies":{"next":"16.3.5"}}',
    'empty/package.json': '{"private":true}',
    [GSPOT_PATHS.npmProject]: '{"dependencies":{"tailwindcss":"4.1.13"}}',
} as const;

export const PROJECT_DEPENDENCY_SCOPES = [
    { scope: '', names: ['@nestjs/swagger'] },
    { scope: 'application', names: ['@nestjs/swagger'] },
    { scope: 'app', names: ['tailwindcss'] },
    { scope: 'app/styles', names: ['tailwindcss'] },
    { scope: 'other', names: ['next'] },
    { scope: 'empty', names: [] },
    { scope: 'empty/src', names: [] },
] as const;

export const INVALID_DEPENDENCY_FILES = [
    ['package.json', '{"dependencies":{"typescript":7}}'],
    ['pyproject.toml', '[project'],
] as const;

export const REACT_VUE_PACKAGES = {
    'package.json': '{"name":"root-sandbox","private":true,"dependencies":{"react":"19.0.0"}}',
    'app/package.json': '{"name":"child-sandbox","private":true,"dependencies":{"vue":"3.5.0"}}',
    'main.js': 'export const ready = true;\n',
    'app/main.js': 'export const ready = true;\n',
} as const;

export const ROOT_PACKAGE_WITHOUT_DEPENDENCIES = '{"name":"root-sandbox","private":true,"dependencies":{}}';

export const PYTHON_DEPENDENCY_CASES = [
    {
        name: 'PEP 621 table',
        path: 'pyproject.toml',
        source: '[project]\ndependencies = ["FastAPI>=1", "Friendly_Bard>=2"]\n',
    },
    {
        name: 'Poetry dependencies',
        path: 'pyproject.toml',
        source: `[tool.poetry.dependencies]
FaStApI = "^1"
"Friendly.Bard" = {version = "^2"}
python = "^3.12"
`,
    },
    {
        name: 'Poetry web group',
        path: 'pyproject.toml',
        source: `[tool.poetry.group.web.dependencies]
FASTAPI = {version = "^1", extras = ["standard"]}
"Friendly...__Bard" = "^2"
`,
    },
    {
        name: 'requirements extras',
        path: 'requirements.txt',
        source: `# Not a dependency: django
FastApi[standard]>=1 # web
Friendly_Bard>=2
--index-url https://example.com/simple
-r other.txt
`,
    },
    {
        name: 'requirements direct address',
        path: 'requirements-dev.txt',
        source: 'FaStApI @ https://example.com/fastapi.whl\nFriendly.Bard==2\n',
    },
    {
        name: 'Pipfile packages',
        path: 'Pipfile',
        source: `[packages]
fastAPI = {version = "*", extras = ["standard"]}
"Friendly--Bard" = "==2"
`,
    },
] as const;

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

export const MKDOCS_CASES = [
    {
        name: 'admonitions in a nested mkdocs.yml',
        path: 'docs/mkdocs.yml',
        source: 'site_name: Example\nmarkdown_extensions:\n  - admonition\n  - toc:\n      permalink: true\n',
        detected: true,
    },
    {
        name: 'content tabs with options',
        path: 'mkdocs.yaml',
        source: 'markdown_extensions:\n  - pymdownx.tabbed:\n      alternate_style: true\n',
        detected: true,
    },
    {
        name: 'no indented extension',
        path: 'mkdocs.yml',
        source: 'markdown_extensions:\n  - toc\n  # - admonition\n',
        detected: false,
    },
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

export const ALIAS_FILES = [
    {
        path: 'package.json',
        message: 'package.json:1:38 is not valid JSON: PropertyNameExpected. Fix the file.',
    },
    {
        path: 'tsconfig.json',
        message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
    },
] as const;

export const ALIAS_PROJECT = {
    'package.json': '{"imports":{"#app/*":"./src/*","#root/*":"./root/*","#shared/*":"./package/*"}}',
    'tsconfig.json': '{"compilerOptions":{"paths":{"@root/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
    'web/package.json': '{"imports":{"#app/*":"./src/*","#shared/*":"./package/*"}}',
    'web/tsconfig.json': '{"compilerOptions":{"paths":{"@web/*":["./typed/*"],"#shared/*":["./compiler/*"]}}}',
} as const;

export const SCOPE_ALIASES = {
    '#app/*': 'src/*',
    '#root/*': 'root/*',
    '@root/*': 'typed/*',
    '#shared/*': 'compiler/*',
} as const;

export const PACKAGE_MANAGER_PIN_CASES = [
    [
        'a packageManager with a hash suffix',
        { 'package.json': '{"packageManager":"pnpm@9.1.0+sha512.0a1b2c"}' },
        'pnpm@9.1.0',
    ],
    [
        'an exact devEngines version',
        { 'package.json': '{"devEngines":{"packageManager":{"name":"yarn","version":"4.2.0"}}}' },
        'yarn@4.2.0',
    ],
    [
        'an explicit manager before a competing lockfile and devEngines declaration',
        {
            'package.json':
                '{"packageManager":"npm@10.9.0","devEngines":{"packageManager":{"name":"yarn","version":"4.2.0"}}}',
            'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
        },
        'npm@10.9.0',
    ],
    [
        'the first devEngines manager in a list',
        {
            'package.json':
                '{"devEngines":{"packageManager":[{"name":"yarn","version":"4.2.0"},{"name":"npm","version":"10.9.0"}]}}',
        },
        'yarn@4.2.0',
    ],
] as const;

export const NON_EXACT_PNPM_VERSIONS = [
    [
        '{"devEngines":{"packageManager":{"name":"pnpm","version":"^9.1.0"}}}',
        'The tool project needs an exact pnpm version, such as pnpm@1.2.3; package.json declares "^9.1.0" in devEngines.packageManager. Write an exact version there.',
    ],
    [
        '{"packageManager":"pnpm@^9.1.0"}',
        'The tool project needs an exact pnpm version, such as pnpm@1.2.3; package.json declares "pnpm@^9.1.0" in packageManager. Write an exact version there.',
    ],
    [
        '{"packageManager":"pnpm"}',
        'The tool project needs an exact pnpm version, such as pnpm@1.2.3; package.json declares "pnpm" in packageManager. Write an exact version there.',
    ],
] as const;

export const UNSUPPORTED_PACKAGE_MANAGERS = [
    { field: 'packageManager', written: 'cnpm@9.0.0', packageJson: { packageManager: 'cnpm@9.0.0' } },
    { field: 'packageManager', written: 'pnpm@9.0.0@x', packageJson: { packageManager: 'pnpm@9.0.0@x' } },
    {
        field: 'devEngines.packageManager',
        written: '9.0.0',
        packageJson: { devEngines: { packageManager: { name: 'cnpm', version: '9.0.0' } } },
    },
] as const;

export const INACTIVE_LERNA_FILES = {
    'package.json': '{}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]\n',
    'lerna.json': 'malformed inactive configuration',
    'packages/app/package.json': '{"name":"inside"}',
} as const;

export const NESTED_WORKSPACE_FILES = {
    'package.json': '{"workspaces":["packages/*"]}',
    'pnpm-workspace.yaml': 'packages: ["packages/*"]',
    'packages/parent/package.json': '{"name":"parent"}',
    'child/package.json': '{}',
    'empty/source.py': '',
} as const;

export const OUTSIDE_WORKSPACE_FILES = [
    ['pnpm-workspace.yaml', 'packages: ["../outside"]\n', '../outside'],
    ['rush.json', '{"projects":[{"packageName":"outside","projectFolder":"packages/linked"}]}', 'packages/linked'],
] as const;
