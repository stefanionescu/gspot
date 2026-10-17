import { BASE_INSTALLED_FILES } from '#tests/data/test-setup.ts';

const MALFORMED_TSCONFIGS = [
    ['{"extends":"./.gspot/tsconfig.json", invalid}', 'Property assignment expected.'],
    ['null', "The root value of a 'tsconfig.json' file must be an object."],
    ['[]', "The root value of a 'tsconfig.json' file must be an object."],
] as const;

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
const STRICT_COMPILER_OPTIONS = {
    ...STRICT_TYPE_FLAGS,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
} as const;

const STRICT_TSCONFIG_TEXT = JSON.stringify({ compilerOptions: STRICT_TYPE_FLAGS });

const COMPILER_SOURCE = 'export const value = missing;\n';

const ROOT_PORT_SOURCE = 'export const port = 8080;\n';

const CHILD_PORT_SOURCE = 'export const port = 3000;\n';

const TYPED_DECLARATION = 'const counter: number = 1;';

const REFERENCE_BUILD_FILES = {
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

const YOUR_TSCONFIG = `{
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
const OUTDIR_CASES = [
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
const STANDALONE_TYPESCRIPT_FILES = {
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

const STANDALONE_TYPESCRIPT_SETTINGS = `[[scope]]
path = "app"
configurations = ["typescript"]
`;

const STANDALONE_FIXED_SOURCE = `export const value = 1;
export const project = acceptedNumber;
export function select(flag: boolean) { return flag ? 1 : 0; }
`;

const STANDALONE_TYPESCRIPT_FINDINGS = {
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
const ANCESTOR_TYPESCRIPT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'source.ts': 'export const rootValue = 1;\n',
    'app/source.ts': 'export const appValue: number = 1;\n',
    'app/deep/source.ts': 'export const deepValue: number = 1;\n',
} as const;

const ANCESTOR_SCOPE_SETTINGS = `[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n[[scope]]\npath = "app/deep"\n\nconfigurations = ["typescript"]\n`;

const ANCESTOR_TYPESCRIPT_PROJECT = {
    compilerOptions: STRICT_COMPILER_OPTIONS,
    include: ['source.ts', 'app/**/*.ts'],
} as const;

const SOLUTION_TSCONFIG =
    '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';

const IMPLICIT_PROJECT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]}}\n',
    'src/clean.ts': 'export const count: number = 1;\n',
    'src/broken.ts': 'export const count: number = "wrong";\n',
} as const;

const TYPESCRIPT_PROJECTS_SANDBOX = {
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

export {
    OUTDIR_CASES,
    YOUR_TSCONFIG,
    COMPILER_SOURCE,
    ROOT_PORT_SOURCE,
    TSCONFIG_PROJECT,
    CHILD_PORT_SOURCE,
    SOLUTION_TSCONFIG,
    TYPED_DECLARATION,
    MALFORMED_TSCONFIGS,
    STRICT_TSCONFIG_TEXT,
    REFERENCE_BUILD_FILES,
    IMPLICIT_PROJECT_FILES,
    ANCESTOR_SCOPE_SETTINGS,
    STANDALONE_FIXED_SOURCE,
    STRICT_COMPILER_OPTIONS,
    ANCESTOR_TYPESCRIPT_FILES,
    ANCESTOR_TYPESCRIPT_PROJECT,
    STANDALONE_TYPESCRIPT_FILES,
    TYPESCRIPT_PROJECTS_SANDBOX,
    STANDALONE_TYPESCRIPT_FINDINGS,
    STANDALONE_TYPESCRIPT_SETTINGS,
};
