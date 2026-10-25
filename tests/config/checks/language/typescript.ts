export const ROOT_PORT_SOURCE = 'export const port = 8080;\n';

export const CHILD_PORT_SOURCE = 'export const port = 3000;\n';

export const TSCONFIG_READ_ERRORS = [
    {
        name: 'an invalid property',
        tsconfig: '{"extends":"./.gspot/tsconfig.json", invalid}',
        error: 'Cannot read the compiler settings in tsconfig.json: Property assignment expected.',
        fixed: 'tsconfig.json',
    },
    {
        name: 'a null root',
        tsconfig: 'null',
        error: "Cannot read the compiler settings in tsconfig.json: The root value of a 'tsconfig.json' file must be an object.",
        fixed: 'tsconfig.json',
    },
    {
        name: 'an array root',
        tsconfig: '[]',
        error: "Cannot read the compiler settings in tsconfig.json: The root value of a 'tsconfig.json' file must be an object.",
        fixed: 'tsconfig.json',
    },

    {
        name: 'malformed JSON',
        tsconfig: '{',
        error: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
        fixed: 'tsconfig.json',
    },
    {
        name: 'a missing inherited configuration',
        tsconfig: '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
        error: "Cannot read the compiler settings in tsconfig.json: Cannot read file '{root}/missing.json'.",
        fixed: 'missing.json',
    },
] as const;

export const RECOMMENDED_COMPILER_OPTIONS = {
    compilerOptions: {
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitOverride: true,
        noFallthroughCasesInSwitch: true,
    },
} as const;

export const MISSING_TSCONFIG_FINDINGS = [
    {
        check: 'typescript/tsconfig',
        file: 'tsconfig.json',
        rule: 'strict',
        fixable: false,
        message: 'strict is not on in this tsconfig.',
        help: 'Turn this compiler option on in this tsconfig.',
    },
] as const;

export const ALL_LEVEL_OPTION_FINDINGS = [
    { file: 'tsconfig.json', rule: 'noImplicitReturns', message: 'noImplicitReturns is not on in this tsconfig.' },
    {
        file: 'tsconfig.json',
        rule: 'noPropertyAccessFromIndexSignature',
        message: 'noPropertyAccessFromIndexSignature is not on in this tsconfig.',
    },
] as const;

export const IMPLICIT_RETURNS_IGNORE =
    '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n';
