import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASE_INSTALLED_FILES } from '#tests/data/setup/sandboxes.ts';

/** The type-check flags that the all-level TypeScript policy requires. */
const STRICT_TYPE_FLAGS = {
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

/** Compiler options required by the all-level TypeScript policy. */
export const STRICT_COMPILER_OPTIONS = {
    ...STRICT_TYPE_FLAGS,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
} as const;

export const STRICT_TSCONFIG_TEXT = JSON.stringify({ compilerOptions: STRICT_TYPE_FLAGS });

export const COMPILER_SOURCE = 'export const value = missing;\n';

export const REFERENCE_BUILD_FILES = {
    '.gitignore': `node_modules/
.venv/
.gspot/
`,
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json': '{"files":[],"references":[{"path":"app"}]}',
    'app/tsconfig.json': '{"extends":"../config/base.json","include":["src/**/*.ts"]}',
    'config/base.json':
        '{"compilerOptions":{"composite":true,"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]}}',
    'app/src/main.ts': 'import type { Value } from "../shared/value.js"; export const port: Value = "wrong";\n',
    'app/shared/value.d.ts': 'export type Value = number;\n',
    'neighbor/source.ts': 'export const ignored: number = "wrong";\n',
    'neighbor/node_modules/unrelated/package.json': '{"name":"unrelated","version":"1.0.0"}',
    'neighbor/.venv/pyvenv.cfg': 'home = unrelated\n',
} as const;

const TSCONFIG_PROJECT =
    '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';

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

/** outDir settings that point outside the project, and what each one writes. */
export const OUTDIR_CASES = [
    { name: 'an absolute outDir outside the project writes no output', kind: 'absolute' },
    { name: 'an outDir through a linked node_modules writes nothing outside the repository', kind: 'symlink' },
] as const;

export const PRIVATE_GLOBAL_FINDING = {
    file: 'app/source.ts',
    line: 1,
    column: 22,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

const SOLUTION_TSCONFIG =
    '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';

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

export const IMPLICIT_PROJECT_TREE = {
    ...IMPLICIT_PROJECT_FILES,
    'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
};

export const SOLUTION_PROJECT_TREE = {
    'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
    '.gitignore': 'node_modules/\n.gspot/\n',
    'tsconfig.json': SOLUTION_TSCONFIG,
    'orders/tsconfig.json': TSCONFIG_PROJECT,
    'users/tsconfig.json': TSCONFIG_PROJECT.replace('"include"', '"references":[{"path":"../orders"}],"include"'),
    'orders/order.ts': 'export const total: number = "wrong";',
    'users/user.ts': 'import { total } from "../orders/order.js"; export const active: boolean = total;',
};

/** Settings with a TypeScript scope for the referenced project. */
export const REFERENCE_BUILD_SETTINGS = {
    level: 'all',
    scopes: [
        { path: 'app', configurations: ['typescript'] },
        { path: 'neighbor', configurations: ['typescript'] },
    ],
} as const;
