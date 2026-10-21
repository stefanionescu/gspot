import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { BASE_INSTALLED_FILES } from '#tests/data/test-setup.ts';

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

export const ROOT_PORT_SOURCE = 'export const port = 8080;\n';

export const CHILD_PORT_SOURCE = 'export const port = 3000;\n';

export const TYPED_DECLARATION = 'const counter: number = 1;';

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

const PRIVATE_GLOBAL_FINDING = {
    file: 'app/source.ts',
    line: 1,
    column: 22,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

// Standalone projects keep authored declarations and exclude generated, vendored, and private tool sources.
export const STANDALONE_TYPESCRIPT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'source.ts': 'export const rootValue = 1;\n',
    'app/source.ts': `export const value = privateValue;
export const project = acceptedNumber;
export function select(flag: boolean) { if (flag) return 1; }
`,
    'app/ambient.d.ts': 'export {};\ndeclare global { const acceptedNumber: number; }\n',
    '.gitattributes': 'app/emitted/** linguist-generated\napp/vendor/** linguist-vendored\n',
    'app/emitted/generated.ts': 'This generated input is not TypeScript.\n',
    'app/vendor/dependency.ts': 'This vendored input is not TypeScript.\n',
    '.gspot/node_modules/@types/private/index.d.ts': 'export {};\ndeclare global { const privateValue: number; }\n',
} as const;

export const STANDALONE_TYPESCRIPT_SETTINGS = `[[scope]]
path = "app"
configurations = ["typescript"]
`;

export const STANDALONE_FIXED_SOURCE = `export const value = 1;
export const project = acceptedNumber;
export function select(flag: boolean) { return flag ? 1 : 0; }
`;

export const STANDALONE_TYPESCRIPT_FINDINGS = {
    recommended: [PRIVATE_GLOBAL_FINDING],
    all: [
        PRIVATE_GLOBAL_FINDING,
        {
            file: 'app/source.ts',
            line: 3,
            column: 17,
            rule: 'TS7030',
            message: 'Not all code paths return a value.',
        },
    ],
} as const;

// One tsconfig in a parent folder includes each scope, so no scope gets its own compiler project.
export const ANCESTOR_TYPESCRIPT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'source.ts': 'export const rootValue = 1;\n',
    'app/source.ts': 'export const appValue: number = 1;\n',
    'app/deep/source.ts': 'export const deepValue: number = 1;\n',
} as const;

export const ANCESTOR_SCOPE_SETTINGS = `[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n[[scope]]\npath = "app/deep"\n\nconfigurations = ["typescript"]\n`;

export const ANCESTOR_TYPESCRIPT_PROJECT = {
    compilerOptions: STRICT_COMPILER_OPTIONS,
    include: ['source.ts', 'app/**/*.ts'],
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

/** A tsconfig.json that TypeScript cannot read, the error that names the file, and the file to fix. */
export const TSCONFIG_READ_ERRORS = [
    {
        name: 'an invalid property',
        tsconfig: '{"extends":"./.gspot/tsconfig.json", invalid}',
        error: /Cannot read TypeScript configuration .*tsconfig\.json: Property assignment expected\./u,
        fixed: 'tsconfig.json',
    },
    {
        name: 'a null root',
        tsconfig: 'null',
        error: /Cannot read TypeScript configuration .*tsconfig\.json: The root value of a 'tsconfig\.json' file must be an object\./u,
        fixed: 'tsconfig.json',
    },
    {
        name: 'an array root',
        tsconfig: '[]',
        error: /Cannot read TypeScript configuration .*tsconfig\.json: The root value of a 'tsconfig\.json' file must be an object\./u,
        fixed: 'tsconfig.json',
    },

    {
        name: 'malformed JSON',
        tsconfig: '{',
        error: /^Cannot read TypeScript configuration .*tsconfig\.json/u,
        fixed: 'tsconfig.json',
    },
    {
        name: 'a missing inherited configuration',
        tsconfig: '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
        // TypeScript prints the inherited path with forward slashes on every system.
        error: /Cannot read file '.*\/missing\.json'/u,
        fixed: 'missing.json',
    },
] as const;

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
