export const ESLINT_RULES = {
    'array-callback-return': 'error',
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
    'no-empty': 'error',

    'no-param-reassign': 'error',
} as const;

export const SORTING_RULES = {
    'perfectionist/sort-imports': [
        'error',
        {
            type: 'line-length',
            order: 'asc',
            ignoreCase: false,
            groups: ['singleline-import', 'multiline-import'],
            fallbackSort: { type: 'alphabetical', order: 'asc' },
            newlinesBetween: 1,
            newlinesInside: 0,
            sortSideEffects: false,
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

export const SONAR_RULES = {
    'sonarjs/assertions-in-tests': 'off',
    'sonarjs/async-test-assertions': 'off',
    'sonarjs/slow-regex': 'off',
    'sonarjs/no-unused-vars': 'off',
    'sonarjs/unused-import': 'off',
    'sonarjs/no-empty-character-class': 'off',
    'sonarjs/no-control-regex': 'off',
    'sonarjs/no-useless-catch': 'off',
    'sonarjs/no-parameter-reassignment': 'off',
    'sonarjs/for-loop-increment-sign': 'off',
    'sonarjs/no-hardcoded-passwords': 'off',
    'sonarjs/no-hardcoded-secrets': 'off',
    'sonarjs/prefer-regexp-exec': 'off',
    'sonarjs/class-name': 'off',

    'sonarjs/no-empty-test-file': 'off',
    'sonarjs/no-collapsible-if': 'error',

    'sonarjs/no-nested-switch': 'error',
    'sonarjs/prefer-object-literal': 'error',
    'sonarjs/no-commented-code': 'error',
    'sonarjs/prefer-immediate-return': 'error',
} as const;

export const UNICORN_RULES = {
    'unicorn/no-lonely-if': 'off',
    'unicorn/name-replacements': 'off',
    'unicorn/filename-case': 'off',
    'unicorn/no-null': 'off',
    'unicorn/no-useless-undefined': 'off',
    'unicorn/import-style': 'off',
    'unicorn/prefer-export-from': 'off',
    'unicorn/no-unnecessary-array-flat-map': 'off',

    'unicorn/prefer-ternary': ['error', 'only-single-line'],
    'unicorn/expiring-todo-comments': ['error', { allowWarningComments: false }],
} as const;

export const SECURITY_RULES = {
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'off',
    'security/detect-new-buffer': 'off',
    'security/detect-non-literal-regexp': 'off',
    'security/detect-non-literal-require': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'off',
    'security/detect-object-injection': 'off',
    'security/detect-non-literal-fs-filename': 'off',

    'security/detect-child-process': 'error',
    'security/detect-possible-timing-attacks': 'error',
} as const;

export const JSDOC_RULES = {
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
                ArrowFunctionExpression: true,
                FunctionExpression: true,
                MethodDefinition: true,
            },
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

export const REGEXP_RULES = {
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
    'regexp/no-lazy-ends': 'error',
    'regexp/no-optional-assertion': 'error',
    'regexp/no-invalid-regexp': 'error',
    'regexp/no-misleading-capturing-group': 'error',
    'regexp/no-contradiction-with-assertion': 'error',
    'regexp/strict': 'error',
} as const;

export const IMPORT_X_RULES = {
    'import-x/export': 'error',
    'import-x/no-cycle': 'error',
    'import-x/no-self-import': 'error',
    'import-x/no-useless-path-segments': 'error',
    'import-x/no-empty-named-blocks': 'error',
    'import-x/no-duplicates': 'error',
} as const;
