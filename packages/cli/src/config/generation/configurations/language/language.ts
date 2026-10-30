import type { StylelintComponent } from '#cli/types/generation/css.ts';

export const SHELLCHECK_OPTIONS = [
    ['source-path', 'SCRIPTDIR'],
    ['external-sources', 'true'],
] as const;

export const SHELLCHECK_ALL_LEVEL_ON = [
    'add-default-case',
    'avoid-negated-conditions',
    'avoid-nullary-conditions',
    'deprecate-which',
    'quote-safe-variables',
    'require-double-brackets',
    'require-variable-braces',
    'useless-use-of-cat',
] as const;

export const SHELLCHECK_CHECKS = [
    'check-extra-masked-returns',
    'check-set-e-suppressed',
    'check-unassigned-uppercase',
] as const;

export const SHELLCHECK_CHECK = 'bash/shellcheck';

const VUE_STYLELINT_OVERRIDE = {
    files: ['**/*.vue'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['deep', 'global', 'slotted'],
    functions: ['v-bind'],
} as const;

const SVELTE_STYLELINT_OVERRIDE = {
    files: ['**/*.svelte'],
    customSyntax: 'postcss-html',
    ignorePseudoClasses: ['global'],
} as const;

export const STYLELINT_BASE_RULES = { 'import-notation': 'string', 'function-no-unknown': true } as const;

export const TAILWIND_AT_RULES = [
    'tailwind',
    'apply',
    'layer',
    'theme',
    'utility',
    'variant',
    'custom-variant',
    'source',
    'plugin',
    'config',
    'reference',
] as const;

export const CSS_MODULES_OVERRIDE = {
    files: ['**/*.module.css'],
    suffix: '.module.css',
    rules: {
        'selector-pseudo-class-no-unknown': [
            true,
            { ignorePseudoClasses: ['export', 'import', 'global', 'local', 'external'] },
        ],
        'selector-type-no-unknown': [true, { ignore: ['custom-elements'], ignoreTypes: ['from'] }],
        'property-no-unknown': [
            true,
            { ignoreProperties: ['composes', 'compose-with'], ignoreSelectors: [':export', '/^:import/'] },
        ],
    },
    atRules: ['value'],
} as const;

export const STYLELINT_DEFAULT_LEVEL_OFF: ReadonlySet<string> = new Set([
    'no-descending-specificity',
    'container-name-pattern',
    'custom-media-pattern',
    'custom-property-pattern',
    'declaration-block-no-redundant-longhand-properties',
    'keyframes-name-pattern',
    'layer-name-pattern',
    'number-max-precision',
    'selector-class-pattern',
    'selector-id-pattern',
    'selector-not-notation',
]);

export const STYLELINT_COMPONENTS: readonly StylelintComponent[] = [
    VUE_STYLELINT_OVERRIDE,
    SVELTE_STYLELINT_OVERRIDE,
    { files: ['**/*.astro'], customSyntax: 'postcss-html', ignorePseudoClasses: [] },
];

export const STYLELINT_CHECK = 'css/stylelint';

export const MARKDOWNLINT_ALL_RULES = ['MD041', 'MD025'] as const;

export const MARKDOWNLINT_RULES = {
    MD018: true,
    MD020: true,
    MD033: false,
    MD024: { siblings_only: true },
    MD046: { style: 'fenced' },
} as const;

export const PRETTIER_STYLE = 'markdownlint/style/prettier';

export const MARKDOWNLINT_CHECK = 'markdown/markdownlint';

export const MARKDOWNLINT_PRETTIER_DISABLED = ['MD013'] as const;

export const BASEDPYRIGHT_LEVELS = { basic: 'recommended', all: 'all' } as const;

export const BASEDPYRIGHT_ALL_LEVEL_OPTIONS = {
    reportImportCycles: 'error',
    reportImplicitOverride: 'error',
    reportUnusedClass: 'none',
    reportUnusedFunction: 'none',
} as const;

export const BASEDPYRIGHT_OPTIONS = {
    strictParameterNoneValue: false,
    enableTypeIgnoreComments: true,
    deprecateTypingAliases: false,
    failOnWarnings: false,
    reportUnusedImport: 'none',
    reportUnusedVariable: 'none',
    reportRedeclaration: 'none',
    reportPrivateUsage: 'none',
    reportSelfClsParameterName: 'none',
    reportUndefinedVariable: 'none',
    reportIgnoreCommentWithoutRule: 'none',
    reportPropertyTypeMismatch: 'error',
    reportMissingTypeStubs: 'none',
    reportImportCycles: 'none',
    reportUnusedClass: 'error',
    reportUnusedFunction: 'error',
    reportDuplicateImport: 'error',
    reportWildcardImportFromLibrary: 'none',
    reportUntypedFunctionDecorator: 'error',
    reportUntypedClassDecorator: 'error',
    reportUntypedBaseClass: 'error',
    reportUntypedNamedTuple: 'error',
    reportTypeCommentUsage: 'none',
    reportPrivateImportUsage: 'none',
    reportDeprecated: 'error',
    reportMissingSuperCall: 'none',
    reportUnknownParameterType: 'error',
    reportUnknownArgumentType: 'error',
    reportUnknownLambdaType: 'error',
    reportUnknownVariableType: 'error',
    reportUnknownMemberType: 'error',
    reportMissingParameterType: 'none',
    reportMissingTypeArgument: 'none',
    reportInvalidTypeVarUse: 'error',
    reportCallInDefaultInitializer: 'none',
    reportUnnecessaryIsInstance: 'error',
    reportUnnecessaryCast: 'error',
    reportUnnecessaryComparison: 'error',
    reportUnnecessaryContains: 'error',
    reportImplicitStringConcatenation: 'none',
    reportInvalidStubStatement: 'error',
    reportIncompleteStub: 'error',
    reportUnsupportedDunderAll: 'error',
    reportUnusedCallResult: 'none',
    reportUnusedCoroutine: 'error',
    reportUnusedExpression: 'error',
    reportUnnecessaryTypeIgnoreComment: 'error',
    reportMatchNotExhaustive: 'error',
    reportImplicitOverride: 'none',
    reportUnreachable: 'error',
    reportAny: 'none',
    reportExplicitAny: 'none',
    reportPrivateLocalImportUsage: 'none',
    reportImplicitRelativeImport: 'none',
    reportUnusedParameter: 'none',
    reportUnannotatedClassAttribute: 'none',
    reportIncompatibleUnannotatedOverride: 'error',
    reportInvalidAbstractMethod: 'error',
    reportSelfClsDefault: 'error',
    reportEmptyAbstractUsage: 'error',
} as const;

export const PYTHON_FILES = ['**/*.py'] as const;

export const RUFF_ISORT = {
    'length-sort': true,
    'length-sort-straight': true,
    'force-sort-within-sections': true,
} as const;

export const RUFF_ALWAYS_OFF = [
    'COM812',
    'COM819',
    'D203',
    'D206',
    'D213',
    'D300',
    'D417',
    'I002',
    'N806',
    'N815',
    'N816',
    'N999',
    'ISC001',
    'ISC002',
    'Q000',
    'Q001',
    'Q002',
    'Q003',
    'RUF023',
    'W191',
] as const;

export const RUFF_TABLE = 'tools.ruff';

export const RUFF_CHECK = 'python/ruff';

export const BASEDPYRIGHT_CHECK = 'python/basedpyright';

export const SQLFLUFF_CAPITALISATION = {
    'capitalisation.keywords': { capitalisation_policy: 'upper' },
    'capitalisation.identifiers': { extended_capitalisation_policy: 'lower' },
    'capitalisation.functions': { extended_capitalisation_policy: 'lower' },
    'capitalisation.literals': { capitalisation_policy: 'upper' },
    'capitalisation.types': { extended_capitalisation_policy: 'upper' },
} as const;

export const SQL_FILE_EXTENSIONS = '.sql,.pgsql,.psql';

export const SQLFLUFF_DEFAULT_LEVEL_OFF = ['AM05', 'AM09', 'CV11', 'ST05', 'ST07', 'ST09'] as const;

export const SQLFLUFF_CHECK = 'sql/sqlfluff';

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
    '@typescript-eslint/consistent-type-imports': 'error',
    'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/require-array-sort-compare': 'error',
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
        },
    ],
    'sonarjs/no-duplicate-in-composite': 'error',
    'sonarjs/redundant-type-aliases': 'error',
} as const;

export const TYPESCRIPT_TEST_RULES = {
    'gspot/no-magic-numbers': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
} as const;
