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
