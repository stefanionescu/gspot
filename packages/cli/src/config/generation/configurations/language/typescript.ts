export const TYPESCRIPT_RULES = {
    '@typescript-eslint/no-misused-spread': ['error', { allow: ['string'] }],
    'sonarjs/deprecation': 'off',
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/check-types': 'off',
    'jsdoc/no-undefined-types': 'off',
    'jsdoc/valid-types': 'off',
    'jsdoc/no-types': 'error',
    'jsdoc/check-tag-names': ['error', { typed: true }],

    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
    '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: false }],
    '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/require-array-sort-compare': ['error', { ignoreStringArrays: true }],
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
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
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
            'ts-ignore': true,
            'ts-nocheck': true,
        },
    ],
    'sonarjs/no-duplicate-in-composite': 'error',
    'sonarjs/redundant-type-aliases': 'error',
} as const;

export const TYPESCRIPT_TEST_RULES = {
    'gspot/no-magic-numbers': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
} as const;
