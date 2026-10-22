export const ROOT_PORT_SOURCE = 'export const port = 8080;\n';
export const CHILD_PORT_SOURCE = 'export const port = 3000;\n';

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

/** Compiler options that level recommended accepts. */
export const RECOMMENDED_COMPILER_OPTIONS = {
    compilerOptions: {
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitOverride: true,
        noFallthroughCasesInSwitch: true,
    },
} as const;

/** The typescript/tsconfig finding of a scope that adds a tsconfig. */
export const MISSING_TSCONFIG_FINDINGS = [
    {
        check: 'typescript/tsconfig',
        file: 'tsconfig.json',
        rule: 'strict',
        fixable: false,
        message: 'strict is not on in this tsconfig.',
        help: 'Enable this compiler option in the TypeScript tool file.',
    },
] as const;

/** The two compiler options that level all requires and level recommended does not. */
export const ALL_LEVEL_OPTION_FINDINGS = [
    { file: 'tsconfig.json', rule: 'noImplicitReturns', message: 'noImplicitReturns is not on in this tsconfig.' },
    {
        file: 'tsconfig.json',
        rule: 'noPropertyAccessFromIndexSignature',
        message: 'noPropertyAccessFromIndexSignature is not on in this tsconfig.',
    },
] as const;
