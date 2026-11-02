import type { FenceParser, StylelintComponent } from '#cli/types/configurations/language.ts';

export const PARENT_TSCONFIG_SKIP = 'The tsconfig of a parent folder covers this project, and gspot checks it there.';

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

export const STYLELINT_COMPONENTS: readonly StylelintComponent[] = [
    VUE_STYLELINT_OVERRIDE,
    SVELTE_STYLELINT_OVERRIDE,
    { files: ['**/*.astro'], customSyntax: 'postcss-html', ignorePseudoClasses: ['global'] },
];

export const STYLELINT_BASE_RULES = {
    'import-notation': 'string',
    'function-no-unknown': true,
    'property-disallowed-list': ['/^(margin|padding|border|inset)-(left|right)/', 'left', 'right'],
    'declaration-property-value-disallowed-list': {
        float: ['left', 'right'],
        clear: ['left', 'right'],
        'text-align': ['left', 'right'],
        outline: ['none', '0'],
    },
    'declaration-property-unit-allowed-list': { 'font-size': ['rem', 'em', '%'] },
    'selector-max-id': 0,
    'selector-max-specificity': '0,3,0',
    'selector-disallowed-list': [String.raw`/^\.(is|has)-[\w-]+$/`],
} as const;

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

export const MARKDOWNLINT_ALL_RULES = ['MD041', 'MD025'] as const;

export const MARKDOWNLINT_RULES = {
    MD018: true,
    MD020: true,
    MD033: false,
    MD024: { siblings_only: true },
    MD026: { punctuation: '.,;:!?。，；：！？' },
    MD046: { style: 'fenced' },
    MD059: {
        prohibited_texts: [
            'here',
            'this',
            'this page',
            'read more',
            'more',
            'click here',
            'link',
            'documentation',
            'docs',
        ],
    },
} as const;

export const PRETTIER_STYLE = 'markdownlint/style/prettier';

export const MARKDOWNLINT_PRETTIER_DISABLED = ['MD013'] as const;

export const TYPESCRIPT_RULES = {
    'no-const-assign': 'error',
    '@typescript-eslint/no-misused-spread': ['error', { allow: ['string'] }],
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

export const HTML_VALIDATE_EXTENDS = ['html-validate:recommended'] as const;

export const HTML_VALIDATE_RULES = {
    'doctype-style': 'off',
    'void-style': 'off',
    'attr-quotes': 'off',
    'attr-case': 'off',
    'element-case': 'off',
    'no-trailing-whitespace': 'off',
} as const;

export const HTML_VALIDATE_OVERRIDES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    site: {
        'no-inline-style': 'off',
        'no-raw-characters': 'off',
        'void-style': 'off',
        'doctype-style': 'off',
        'no-trailing-whitespace': 'off',
        'valid-id': ['error', { relaxed: true }],
    },
};

export const SURROUNDING_QUOTES = /^["']|["']$/gu;

export const EXECUTABLE_SCRIPT_TYPES: ReadonlySet<string> = new Set([
    '',
    'module',
    'application/ecmascript',
    'application/javascript',
    'application/x-ecmascript',
    'application/x-javascript',
    'text/ecmascript',
    'text/javascript',
    'text/javascript1.0',
    'text/javascript1.1',
    'text/javascript1.2',
    'text/javascript1.3',
    'text/javascript1.4',
    'text/javascript1.5',
    'text/jscript',
    'text/livescript',
    'text/x-ecmascript',
    'text/x-javascript',
]);

export const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'background']);

export const DOCUMENT_URL_ATTRIBUTES: ReadonlyMap<string, readonly string[]> = new Map([
    ['a', ['href', 'xlink:href']],
    ['area', ['href']],
    ['iframe', ['src']],
    ['frame', ['src']],
    ['object', ['data']],
    ['embed', ['src']],
]);

export const ACTIVE_DOCUMENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);

export const EVENT_ATTRIBUTE = /^on[a-z]+$/u;

export const SCRIPT_SCHEMES = new Set(['javascript:', 'vbscript:']);

export const RELATIVE_URL_BASE = 'https://example.invalid';

export const INLINE_SCRIPT_MESSAGE = 'Move executable inline script to a script file.';

export const HTML_RULES = {
    scriptLink: 'script-link',
    inlineScript: 'inline-script',
    handlerAttribute: 'handler-attribute',
} as const;

export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

export const ELLIPSIS_ARGUMENTS = '(...)';

export const ANGLE_PLACEHOLDER = /<[A-Za-z][\w-]*>/gu;

export const FENCE_PARSERS: ReadonlyMap<string, FenceParser> = new Map([
    ['json', 'json'],
    ['jsonc', 'jsonc'],
    ['toml', 'toml'],
    ['yaml', 'yaml'],
    ['yml', 'yaml'],
    ['bash', 'bash'],
    ['sh', 'bash'],
    ['shell', 'bash'],
    ['ts', 'typescript'],
    ['typescript', 'typescript'],
    ['tsx', 'tsx'],
    ['js', 'javascript'],
    ['jsx', 'javascript'],
    ['javascript', 'javascript'],
    ['mjs', 'javascript'],
    ['cjs', 'javascript'],
    ['python', 'python'],
    ['py', 'python'],
]);

export const JSON_FENCE_OPTIONS = { disallowComments: true, allowTrailingComma: false } as const;

export const OMITTED_BASH_LINE = ':';

export const EMPTY_ARGUMENTS = '()';

export const PLACEHOLDER_VALUE = 'PLACEHOLDER';

export const CAMEL_CASE_BOUNDARY = /(?<first>[a-z])(?<next>[A-Z])/gu;

export const SYNTAX_ERROR_MESSAGE = 'Syntax error.';

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
