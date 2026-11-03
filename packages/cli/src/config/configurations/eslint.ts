export const JAVASCRIPT_RULES = {
    'no-implied-eval': 'error',
    'no-throw-literal': 'error',
    'no-unused-expressions': 'error',
    'no-unused-vars': [
        'error',
        {
            args: 'all',
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
        },
    ],
    'jsdoc/require-param-type': 'error',
    'jsdoc/require-returns-type': 'error',
    'jsdoc/check-types': 'error',
    'jsdoc/no-undefined-types': 'error',
    'jsdoc/valid-types': 'error',
} as const;

export const SCRIPT_RULES = { 'n/no-process-exit': 'off', 'unicorn/no-process-exit': 'off' } as const;

export const CONSOLE_RULES = { 'no-console': 'error' } as const;

const ESLINT_RULES = {
    'array-callback-return': 'error',
    'block-scoped-var': 'error',
    'no-const-assign': 'error',
    'no-loop-func': 'error',
    'no-labels': 'error',
    'no-new': 'error',
    'no-nested-ternary': 'error',
    'default-case-last': 'error',
    'no-void': 'error',
    'no-constructor-return': 'error',
    'no-new-func': 'error',
    'no-promise-executor-return': 'error',
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-template-curly-in-string': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unreachable-loop': 'error',
    'no-var': 'error',
    'no-empty-character-class': 'off',
    'no-useless-constructor': 'error',
    'no-useless-return': 'error',
    'no-useless-call': 'error',
    'no-useless-rename': 'error',
    'no-duplicate-imports': 'off',
    eqeqeq: 'error',
    'prefer-const': 'error',

    'no-param-reassign': 'error',

    'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }],
} as const;

const SORTING_RULES = {
    'perfectionist/sort-imports': [
        'error',
        {
            type: 'line-length',
            ignoreCase: false,
            groups: ['singleline-import', 'multiline-import'],
            fallbackSort: { type: 'alphabetical', order: 'asc' },
            useExperimentalDependencyDetection: false,
        },
    ],
    'perfectionist/sort-named-imports': ['error', { type: 'line-length', ignoreCase: false }],
    'perfectionist/sort-exports': [
        'error',
        {
            type: 'line-length',
            groups: ['singleline-export', 'multiline-export'],
            newlinesBetween: 1,
            ignoreCase: false,
        },
    ],
    'perfectionist/sort-named-exports': ['error', { type: 'line-length', ignoreCase: false }],
} as const;

const UNICORN_RULES = {
    'unicorn/name-replacements': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/import-style': 'off',
    'unicorn/prefer-export-from': 'off',
    'unicorn/no-unnecessary-array-flat-map': 'off',
    'unicorn/no-abusive-eslint-disable': 'off',

    'unicorn/prefer-ternary': 'off',
    'unicorn/prefer-await': 'off',
    'unicorn/expiring-todo-comments': 'off',
    'unicorn/consistent-boolean-name': [
        'error',
        { checkFunctions: 'never', ignore: ['^_', '^(?:enabled|active|retryable)$'] },
    ],
} as const;

const SECURITY_RULES = {
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'off',
    'security/detect-new-buffer': 'off',
    'security/detect-non-literal-regexp': 'off',
    'security/detect-non-literal-require': 'off',
    'security/detect-pseudoRandomBytes': 'off',
    'import-x/no-dynamic-require': 'error',
    'security/detect-unsafe-regex': 'off',
    'security/detect-object-injection': 'off',
    'security/detect-non-literal-fs-filename': 'off',

    'security/detect-child-process': 'error',
    'security/detect-possible-timing-attacks': 'error',
} as const;

const JSDOC_RULES = {
    'jsdoc/require-param-name': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/no-types': 'off',

    'jsdoc/require-jsdoc': [
        'error',
        {
            enableFixer: false,
            publicOnly: true,
            require: {
                FunctionDeclaration: true,
                MethodDefinition: true,
            },
            contexts: [
                ':matches(VariableDeclarator, AssignmentExpression, ExportDefaultDeclaration, PropertyDefinition) > :matches(ArrowFunctionExpression, FunctionExpression)',
            ],
        },
    ],
    'jsdoc/require-description': 'error',
    'jsdoc/require-param': ['error', { enableFixer: false }],
    'jsdoc/match-name': [
        'error',
        {
            match: [
                {
                    tags: ['param'],
                    disallowName: String.raw`/^root\d+$/`,
                    message: 'Name the parameter for its role, such as options.',
                },
            ],
        },
    ],
    'jsdoc/informative-docs': 'error',
    'jsdoc/require-param-description': 'error',
    'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
} as const;

const REGEXP_RULES = {
    'regexp/no-super-linear-backtracking': 'error',
    'regexp/no-empty-alternative': 'error',
    'regexp/no-empty-capturing-group': 'error',
    'regexp/no-empty-character-class': 'error',
    'regexp/no-empty-group': 'error',
    'regexp/no-empty-lookarounds-assertion': 'error',
    'regexp/no-useless-assertions': 'error',
    'regexp/no-useless-backreference': 'error',
    'regexp/no-useless-character-class': 'error',
    'regexp/no-useless-dollar-replacements': 'error',
    'regexp/no-useless-lazy': 'error',
    'regexp/no-useless-quantifier': 'error',
    'regexp/no-useless-range': 'error',
    'regexp/no-lazy-ends': ['error', { ignorePartial: false }],
    'regexp/no-optional-assertion': 'error',
    'regexp/no-invalid-regexp': 'error',
    'regexp/no-misleading-capturing-group': 'error',
    'regexp/no-contradiction-with-assertion': 'error',
    'regexp/strict': 'error',
    'regexp/no-super-linear-move': 'error',
    'regexp/no-dupe-characters-character-class': 'error',
    'regexp/prefer-character-class': ['error', { minAlternatives: 2 }],
    'regexp/prefer-d': 'error',
    'regexp/prefer-w': 'error',
    'regexp/prefer-question-quantifier': 'error',
    'regexp/prefer-star-quantifier': 'error',
    'regexp/prefer-plus-quantifier': 'error',
    'regexp/no-useless-two-nums-quantifier': 'error',
    'regexp/no-zero-quantifier': 'error',
    'regexp/match-any': 'error',
    'regexp/prefer-result-array-groups': 'error',
    'regexp/prefer-named-replacement': 'error',
    'regexp/prefer-named-backreference': 'error',
    'regexp/no-unused-capturing-group': 'error',
} as const;

export const IMPORT_CYCLES_CONFIG = `import config from './eslint.mjs';

export default [
    ...config.map(({ rules: _rules, ...block }) => block),
    {
        linterOptions: { reportUnusedDisableDirectives: 'off' },
        rules: { 'import-x/no-cycle': ['error', { ignoreExternal: true }] },
    },
];
`;

const IMPORT_X_RULES = {
    'import-x/export': 'error',
    'import-x/no-self-import': 'error',
    'import-x/no-useless-path-segments': 'error',
    'import-x/no-empty-named-blocks': 'error',
    'import-x/no-duplicates': 'error',
    'import-x/no-mutable-exports': 'error',
    'import-x/no-relative-packages': 'error',
    'import-x/no-default-export': 'error',
} as const;

export const BASE_RULES = {
    ...ESLINT_RULES,
    ...SORTING_RULES,
    ...UNICORN_RULES,
    ...SECURITY_RULES,
    ...JSDOC_RULES,
    ...REGEXP_RULES,
    ...IMPORT_X_RULES,
} as const;
