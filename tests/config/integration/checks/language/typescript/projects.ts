import { BASE_INSTALLED_FILES } from '#tests/config/integration/checks/samples.ts';

export const REFERENCE_BUILD_FILES = {
    '.gitignore': `node_modules/
.venv/
.gspot/
`,
    'package.json': '{"private":true,"type":"module"}\n',
    'config/base.json':
        '{"compilerOptions":{"composite":true,"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]}}',
    'app/src/main.ts': 'import type { Value } from "../shared/value.js"; export const port: Value = "wrong";\n',
    'app/shared/value.d.ts': 'export type Value = number;\n',
    'neighbor/source.ts': 'export const ignored: number = "wrong";\n',
    'neighbor/node_modules/unrelated/package.json': '{"name":"unrelated","version":"1.0.0"}',
    'neighbor/.venv/pyvenv.cfg': 'home = unrelated\n',
} as const;

export const AUTHORED_TSCONFIG = `{
    // The application owns its build and module settings.
    "compilerOptions": {
        "strict": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": [],
        "incremental": true,
        "tsBuildInfoFile": %BUILD_INFO%
    },
    "include": ["src"],
}\n`;

export const OUTDIR_CASES = [
    { name: 'an absolute outDir outside the project writes no output', kind: 'absolute' },
    { name: 'an outDir through a linked node_modules writes nothing outside the repository', kind: 'symlink' },
] as const;

export const IMPLICIT_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]}}\n',
    'src/clean.ts': 'export const count: number = 1;\n',
    'src/broken.ts': 'export const count: number = "wrong";\n',
} as const;

export const TYPESCRIPT_PROJECTS_SANDBOX = {
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

const TSCONFIG_PROJECT =
    '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';

const SOLUTION_TSCONFIG =
    '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';

export const SOLUTION_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'tsconfig.json': SOLUTION_TSCONFIG,
    'orders/tsconfig.json': TSCONFIG_PROJECT,
    'users/tsconfig.json': TSCONFIG_PROJECT.replace('"include"', '"references":[{"path":"../orders"}],"include"'),
    'orders/order.ts': 'export const total: number = "wrong";',
    'users/user.ts': 'import { total } from "../orders/order.js"; export const active: boolean = total;',
};

export const REFERENCE_BUILD_SETTINGS = {
    level: 'all',
    scopes: [
        { path: 'app', configurations: ['typescript'] },
        { path: 'neighbor', configurations: ['typescript'] },
    ],
} as const;
