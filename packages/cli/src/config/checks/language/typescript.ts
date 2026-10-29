export const TSCONFIG_NAME = /^tsconfig\.(?:.+\.)?json$/u;

export const MISSING_TSCONFIG_RULE = 'missing';

export const MISSING_TSCONFIG_MESSAGE =
    'Add a tsconfig.json to this scope. ESLint and tsc read the TypeScript files through it.';

export const OPTION_HELP = 'Turn this compiler option on in this tsconfig.';

export const STRICT_FAMILY_OPTIONS = [
    'alwaysStrict',
    'noImplicitAny',
    'noImplicitThis',
    'strictBindCallApply',
    'strictBuiltinIteratorReturn',
    'strictFunctionTypes',
    'strictNullChecks',
    'strictPropertyInitialization',
    'useUnknownInCatchVariables',
] as const;
