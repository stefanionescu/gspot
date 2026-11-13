// checks

export const MISSING_TSCONFIG_HELP = 'Add a tsconfig.json that includes these files.';
export const MISSING_TSCONFIG_MESSAGE =
    'Add a tsconfig.json to this scope. ESLint reads the TypeScript files through it.';
export const MISSING_TSCONFIG_RULE = 'missing';
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
export const TSCONFIG_NAME = /^tsconfig\.(?:.+\.)?json$/u;
export const UNREADABLE_TSCONFIG_HELP =
    'Install the package that the tsconfig extends, or correct the file. For a template that nobody installs, run gspot ignore typescript/tsconfig with its paths and a reason.';
export const UNREADABLE_TSCONFIG_RULE = 'unreadable';

// generated config
export const DEFAULT_PROJECT_FILE_LIMIT = 8;
export const DEFAULT_PROJECT_LIMIT_OPTION = 'maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING';
export const TYPESCRIPT_RULES = {
    'no-const-assign': 'error',
    '@typescript-eslint/no-misused-spread': ['error', { allow: ['string'] }],
    '@typescript-eslint/no-unnecessary-condition': ['error', { checkTypePredicates: true }],
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/check-types': 'off',
    'jsdoc/no-undefined-types': 'off',
    'jsdoc/valid-types': 'off',
    'jsdoc/no-types': 'error',
    'jsdoc/check-tag-names': ['error', { typed: true }],

    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/dot-notation': 'error',
    'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/require-array-sort-compare': 'error',
    'unicorn/require-array-sort-compare': 'off',
    'unicorn/no-useless-coercion': 'off',
    '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            args: 'all',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            ignoreUsingDeclarations: true,
        },
    ],
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
            allowAny: false,
            allowBoolean: false,
            allowNever: false,
            allowNullish: false,
            allowNumber: true,
            allowRegExp: false,
        },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never', arrayLiteralTypeAssertions: 'never' },
    ],
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    'gspot/no-magic-numbers': [
        'error',
        {
            ignoreEnums: true,
            ignoreArrayIndexes: true,
            ignoreReadonlyClassProperties: true,
            ignoreTypeIndexes: true,
            ignore: [-1, 0, 1],
        },
    ],
    '@typescript-eslint/ban-ts-comment': [
        'error',
        {
            'ts-expect-error': false,
        },
    ],
} as const;
export const TYPESCRIPT_TEST_RULES = {
    'gspot/no-magic-numbers': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
} as const;
