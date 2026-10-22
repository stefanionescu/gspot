export const ESLINT_RULES = {
    // regexp also validates constructor patterns and Unicode set expressions.
    'no-empty-character-class': 'off',
    'no-useless-constructor': 'error',
    'no-useless-return': 'error',
    'no-useless-call': 'error',
    'no-useless-rename': 'error',
    // import-x/no-duplicates owns duplicate imports and can merge them.
    'no-duplicate-imports': 'off',
    eqeqeq: ['error', 'always'],
    'prefer-const': 'error',
    'no-empty': ['error', { allowEmptyCatch: false }],

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
    // Jest and Vitest expect-expect check assertions in their test files.
    'sonarjs/assertions-in-tests': 'off',
    // Jest and Vitest valid-expect check await semantics in their test files.
    'sonarjs/async-test-assertions': 'off',
    // regexp owns exponential and polynomial backtracking, including constructor patterns.
    'sonarjs/slow-regex': 'off',
    // Core and TypeScript unused-variable rules cover bindings and imports, including intentional ignores.
    'sonarjs/no-unused-vars': 'off',
    'sonarjs/unused-import': 'off',
    // Other lint rules own these defects, so sonarjs only repeats their reports.
    'sonarjs/no-empty-character-class': 'off',
    'sonarjs/no-control-regex': 'off',
    'sonarjs/no-useless-catch': 'off',
    'sonarjs/no-parameter-reassignment': 'off',
    'sonarjs/for-loop-increment-sign': 'off',
    // The secrets configuration owns secret detection.
    'sonarjs/no-hardcoded-passwords': 'off',
    'sonarjs/no-hardcoded-secrets': 'off',

    // sonarjs counts only the test calls in the file, so it reports a test file whose tests come from a shared
    // function.
    'sonarjs/no-empty-test-file': 'off',
    'sonarjs/no-collapsible-if': 'error',

    'sonarjs/no-nested-switch': 'error',
    'sonarjs/prefer-object-literal': 'error',
    'sonarjs/no-commented-code': 'error',
    'sonarjs/prefer-immediate-return': 'error',
} as const;

export const UNICORN_RULES = {
    // sonarjs/no-collapsible-if owns nested conditions at both levels.
    'unicorn/no-lonely-if': 'off',
    // The naming check owns abbreviations and filename case; two owners give conflicting answers.
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/filename-case': 'off',
    // Platform APIs and syntax trees return null; replacing every null creates changes without fixing a defect.
    'unicorn/no-null': 'off',
    // An explicit undefined satisfies noImplicitReturns and a required parameter typed with undefined; its fixer
    // removes both.
    'unicorn/no-useless-undefined': 'off',
    // unicorn/import-style asks for a default import of node:path; gspot uses a default import only when a package
    // requires one.
    'unicorn/import-style': 'off',
    // unicorn/prefer-export-from asks for re-exports, and gspot imports each name from the module that declares it.
    'unicorn/prefer-export-from': 'off',

    'unicorn/prefer-ternary': ['error', 'only-single-line'],
    'unicorn/expiring-todo-comments': ['error', { allowWarningComments: false }],
} as const;

export const SECURITY_RULES = {
    'security/detect-disable-mustache-escape': 'error',
    // Sonar covers dynamic code; Node covers deprecated constructors without matching local names.
    'security/detect-eval-with-expression': 'off',
    'security/detect-new-buffer': 'off',
    // detect-non-literal-regexp flags constructors without examining their input.
    'security/detect-non-literal-regexp': 'off',
    'security/detect-non-literal-require': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    // regexp analyzes backtracking instead of treating nested repetition as an unsafe pattern.
    'security/detect-unsafe-regex': 'off',
    // detect-object-injection fires on every bracket access and detect-non-literal-fs-filename on every path
    // variable; those operations alone do not show that the input causes a defect.
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
            // The fixer writes an empty /** */ block, which documents nothing.
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
    // A blank line before the tags makes them their own paragraph, so Vale reads the description alone.
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
    'import-x/no-cycle': ['error', { ignoreExternal: false }],
    'import-x/no-self-import': 'error',
    'import-x/no-useless-path-segments': 'error',
    'import-x/no-empty-named-blocks': 'error',
    'import-x/no-duplicates': 'error',
} as const;
