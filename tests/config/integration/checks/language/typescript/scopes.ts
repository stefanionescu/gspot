export const KEPT_DECLARATION_FILES = [
    'app/ambient.d.ts',
    'app/emitted/generated.ts',
    'app/vendor/dependency.ts',
    '.gspot/node_modules/@types/private/index.d.ts',
] as const;

export const TYPESCRIPT_SCOPES_SANDBOX = {
    install: false,
    configurations: ['typescript'],
    level: 'all',
    files: { 'package.json': '{"private":true}\n' },
} as const;

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

const PRIVATE_GLOBAL_FINDING = {
    file: 'app/source.ts',
    line: 1,
    column: 22,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

export const STANDALONE_TYPESCRIPT_FINDINGS = {
    basic: [PRIVATE_GLOBAL_FINDING],
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
