const COMPILER_OPTIONS = {
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    jsx: 'preserve',
    resolveJsonModule: true,
    noEmit: true,
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
    noPropertyAccessFromIndexSignature: true,
} as const;

export const DEFAULT_TSCONFIG_PROJECTS = [
    {
        scope: '',
        config: {
            compilerOptions: {
                ...COMPILER_OPTIONS,
                typeRoots: ['node_modules/@types'],
            },
            files: ['../../source.ts'],
        },
    },
    {
        scope: 'service',
        config: {
            compilerOptions: {
                ...COMPILER_OPTIONS,
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                typeRoots: ['service/node_modules/@types', 'node_modules/@types'],
            },
            files: ['../../../service/source.ts'],
        },
    },
] as const;

export const IMPLICIT_RETURNS_IGNORE =
    '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n';

export const REFERENCE_BUILD_FILES = {
    '.gitignore': 'node_modules/\n.venv/\n.gspot/\n',
    'package.json': '{"private":true,"type":"module"}\n',
    'config/base.json':
        '{"compilerOptions":{"composite":true,"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[],"baseUrl":"..","paths":{"@lib/*":["lib/*.d.ts"]}}}',
    'app/src/main.ts': 'import type { Value } from "@lib/value"; export const port: Value = "wrong";\n',
    'lib/value.d.ts': 'export type Value = number;\n',
    'neighbor/tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]},"include":["*.ts"]}',
    'neighbor/source.ts': 'export const ignored: number = "wrong";\n',
    'neighbor/node_modules/unrelated/package.json': '{"name":"unrelated","version":"1.0.0"}',
    'neighbor/.venv/pyvenv.cfg': 'home = unrelated\n',
} as const;

export const REFERENCE_BUILD_RESULTS = [
    { scope: '', status: 'passed' as const, findings: [] },
    { scope: 'app', status: 'failed' as const, findings: [{ file: 'app/src/main.ts', rule: 'TS2322' }] },
    { scope: 'neighbor', status: 'failed' as const, findings: [{ file: 'neighbor/source.ts', rule: 'TS2322' }] },
];
