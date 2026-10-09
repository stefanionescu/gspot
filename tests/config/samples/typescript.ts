// The package manifests of test TypeScript repositories.

export const ZOD_PACKAGE =
    '{\n    "name": "example",\n    "version": "1.0.0",\n    "description": "A test package for the tests.",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "zod": "4.6.2"\n    }\n}\n';

export const TYPESCRIPT_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "description": "A test TypeScript repository.",
    "type": "module",
    "imports": {
        "#types/*": "./types/*"
    },
    "packageManager": "bun@${Bun.version}",
    "engines": {
        "node": ">=22.0.0"
    }
}
`;

/** Compiler options required by the all-level TypeScript policy. */
export const STRICT_COMPILER_OPTIONS = {
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
};

export const VALID =
    '{"compilerOptions":{"strict":true,"noImplicitReturns":true,"noPropertyAccessFromIndexSignature":true,"noFallthroughCasesInSwitch":true,"noUncheckedIndexedAccess":true,"noImplicitOverride":true,"exactOptionalPropertyTypes":true}}';

export const COMPILER_SOURCE = 'export const value = missing;\n';

/** An imported declaration is a native program dependency, without being a configuration root. */
export const IMPORTED_AMBIENT_FILES = {
    'base.json':
        '{"compilerOptions":{"strict":true,"types":[],"allowJs":true,"checkJs":true,"noEmit":true,"baseUrl":".","paths":{"shared-api":["types/api.d.ts"]}}}',
    'types/api.d.ts': 'export declare const amount: number;\n',
    'apps/web/jsconfig.json': '{"extends":"../../base.json","files":["src/main.js"]}',
    'apps/web/src/main.js': 'import { amount } from "shared-api"; export const total = amount.toFixed();\n',
    'sibling/bad.js': 'unknownValue();\n',
};

export const ROOT_PORT_SOURCE = 'export const port = 8080;\n';

export const CHILD_PORT_SOURCE = 'export const port = 3000;\n';
