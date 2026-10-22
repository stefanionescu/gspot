import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript/projects.ts';

/** The declaration and generated files that a TypeScript check keeps. */
export const KEPT_DECLARATION_FILES = [
    'app/ambient.d.ts',
    'app/emitted/generated.ts',
    'app/vendor/dependency.ts',
    '.gspot/node_modules/@types/private/index.d.ts',
] as const;

/** The TypeScript sandbox whose scopes the tests check. */
export const TYPESCRIPT_SCOPES_SANDBOX = {
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
} as const;

/** Standalone projects keep authored declarations and exclude generated, vendored, and private tool sources. */
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

export const STANDALONE_TYPESCRIPT_TABLES = `[[scope]]
path = "app"
configurations = ["typescript"]
`;

export const STANDALONE_CORRECTED_SOURCE = `export const value = 1;
export const project = acceptedNumber;
export function select(flag: boolean) { return flag ? 1 : 0; }
`;

const PRIVATE_GLOBAL_FINDING = {
    file: 'app/source.ts',
    line: 1,
    column: 22,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

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

/** One tsconfig in a parent folder includes each scope, so no scope gets its own compiler project. */
export const ANCESTOR_TYPESCRIPT_FILES = {
    '.gitignore': 'node_modules/\n.gspot/\n',
    'source.ts': 'export const rootValue = 1;\n',
    'app/source.ts': 'export const appValue: number = 1;\n',
    'app/deep/source.ts': 'export const deepValue: number = 1;\n',
} as const;

export const ANCESTOR_SCOPE_TABLES = `[[scope]]\npath = "app"\nconfigurations = ["typescript"]\n[[scope]]\npath = "app/deep"\n\nconfigurations = ["typescript"]\n`;

export const ANCESTOR_TYPESCRIPT_PROJECT = {
    compilerOptions: STRICT_COMPILER_OPTIONS,
    include: ['source.ts', 'app/**/*.ts'],
} as const;
