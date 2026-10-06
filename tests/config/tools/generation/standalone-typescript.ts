const PRIVATE_GLOBAL_DIAGNOSTIC = {
    file: 'app/source.ts',
    line: 1,
    column: 22,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
};

// Standalone projects keep authored declarations and exclude generated, vendored, and private tool sources.
export const STANDALONE_TYPESCRIPT_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'source.ts': 'export const rootValue = 1;\n',
    'app/source.ts':
        'export const value = privateValue;\nexport const project = acceptedNumber;\nexport function select(flag: boolean) { if (flag) return 1; }\n',
    'app/ambient.d.ts': 'export {};\ndeclare global { const acceptedNumber: number; }\n',
    'app/emitted/generated.ts': 'This generated input is not TypeScript.\n',
    'app/vendor/dependency.ts': 'This vendored input is not TypeScript.\n',
    '.gspot/node_modules/@types/private/index.d.ts': 'export {};\ndeclare global { const privateValue: number; }\n',
};

export const STANDALONE_TYPESCRIPT_TABLES = `[[scope]]
path = "app"
configurations = ["typescript"]
[[generated]]
paths = ["app/emitted/**"]
reason = "The fixture compiler owns these outputs."
[[vendored]]
paths = ["app/vendor/**"]
reason = "The fixture preserves these upstream sources."
`;

export const STANDALONE_CORRECTED_SOURCE =
    'export const value = 1;\nexport const project = acceptedNumber;\nexport function select(flag: boolean) { return flag ? 1 : 0; }\n';

export const STANDALONE_TYPESCRIPT_DIAGNOSTICS = {
    recommended: [PRIVATE_GLOBAL_DIAGNOSTIC],
    all: [
        PRIVATE_GLOBAL_DIAGNOSTIC,
        {
            file: 'app/source.ts',
            line: 3,
            column: 17,
            rule: 'TS7030',
            message: 'Not all code paths return a value.',
        },
    ],
};
