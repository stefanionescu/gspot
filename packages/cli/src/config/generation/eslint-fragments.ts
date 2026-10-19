const ASTRO_RULES = {
    'astro/no-set-html-directive': 'error',
    'astro/no-exports-from-components': 'error',
    'astro/no-prerender-export-outside-pages': 'error',

    'astro/no-unused-css-selector': 'error',
    'astro/prefer-class-list-directive': 'error',
    'astro/prefer-object-class-list': 'error',
    'astro/prefer-split-class-list': 'error',
} as const;

const EXPO_RULES = {
    'expo/no-env-var-destructuring': 'error',
    'expo/no-dynamic-env-var': 'error',
    'expo/use-dom-exports': 'error',
    'expo/prefer-box-shadow': 'error',
} as const;

const EXPRESS_RULES = { 'security/detect-no-csrf-before-method-override': 'error' } as const;

const REACT_NATIVE_RULES = {
    '@react-native/platform-colors': 'error',
    '@react-native/no-deep-imports': 'error',
    'react-native/no-unused-styles': 'error',
    'react-native/no-raw-text': 'error',
    'react-native/no-single-element-style-arrays': 'error',

    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'error',
    'react-native/no-color-literals': 'error',
} as const;

const SVELTE_RULES = {
    'svelte/no-target-blank': 'error',
    'svelte/button-has-type': 'error',
    'svelte/no-useless-mustaches': 'error',
    'svelte/prefer-const': 'error',
} as const;

const TRANSLATIONS_RULES = { 'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }] } as const;

const REACT_RULES = {
    'react/no-array-index-key': 'error',
    'react/self-closing-comp': 'error',
    'react/no-danger': 'error',
    'react/no-unstable-nested-components': 'error',
    'react/jsx-no-constructed-context-values': 'error',
    'react/no-object-type-as-default-prop': 'error',
} as const;

const JSX_CODE_FILES = ['**/*.{js,jsx,ts,tsx}'] as const;

const TYPESCRIPT_RULES = {
    '@typescript-eslint/no-misused-spread': ['error', { allow: ['string'] }],
    // The TypeScript rule owns deprecated API uses.
    'sonarjs/deprecation': 'off',
    // TypeScript owns the types, so JSDoc carries none.
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/check-types': 'off',
    'jsdoc/no-undefined-types': 'off',
    'jsdoc/valid-types': 'off',
    'jsdoc/no-types': 'error',

    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    // import-x groups `import A, { type B }` with `import type { C }` and merges them into code that does not parse,
    // unless the merge writes inline type specifiers.
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
    'no-unused-vars': 'off',
} as const;

const TYPESCRIPT_TEST_RULES_OFF = {
    'gspot/no-magic-numbers': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
} as const;

const NESTJS_ALL_LEVEL_RULES = {
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
} as const;

const NESTJS_INJECTABLE_FILTER_PATHS = [
    '/dist/',
    '/node_modules/',
    String.raw`\.test\.`,
    String.raw`\.spec\.`,
] as const;

const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;

const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;

const REFRESH_RULE = 'react-refresh/only-export-components';

const TABINDEX_RULES = ['jsx-a11y/no-noninteractive-tabindex', 'astro/jsx-a11y/no-noninteractive-tabindex'] as const;

/** Roles that may take tabIndex: a tab panel, as jsx-a11y allows, and a scrollable region that keyboards must reach. */
const FOCUSABLE_ROLES = ['tabpanel', 'region'] as const;

/** Next.js higher-order components that react-refresh does not know: catchError from next/error, in Next.js 16.2. */
const NEXT_EXTRA_HOCS = ['catchError'] as const;

const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;

const VUE_RULES = {
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-true-attribute-shorthand': 'error',
    'vue/no-unused-refs': 'error',
    'vue/require-typed-ref': 'error',
    'vue/html-button-has-type': 'error',
    'vue/no-template-target-blank': 'error',
} as const;

const ASTRO_FILES = ['**/*.astro'] as const;
const ASTRO_SCRIPT_FILES = ['**/*.astro/*.ts', '**/*.astro/*.js'] as const;

const SVELTE_FILES = ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'] as const;

const JSX_FILES = ['**/*.{jsx,tsx}'] as const;

const TESTING_LIBRARY_DEFAULT_PRESET = 'dom';

const ZUSTAND_STORE_CREATORS = ['create', 'createStore'] as const;

const ZOD_RULES = [
    'no-any-schema',
    'no-coerce-boolean',
    'no-empty-custom-schema',
    'no-native-enum',
    'no-promise-schema',
    'no-throw-in-refine',
    'prefer-strict-object',
    'prefer-meta-last',
    'require-brand-type-parameter',
] as const;

const DRIZZLE_RULES = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'] as const;

const JEST_GLOBAL_PACKAGE = '@jest/globals';

/** Import statements, selectors, and lint rules for the fragments with no configuration-specific calculation. */
const PLUGIN_LINT_RULE_FRAGMENTS: Readonly<
    Record<
        string,
        {
            imports: readonly string[];
            plugins: string;
            files: 'code' | readonly string[];
            ignores?: 'testFiles';
            rules: Readonly<Record<string, unknown>>;
        }
    >
> = {
    expo: {
        imports: ["import expoPlugin from 'eslint-plugin-expo';"],
        plugins: 'plugins: { expo: expoPlugin }',
        files: 'code',
        rules: EXPO_RULES,
    },
    express: { imports: [], plugins: '', files: 'code', rules: EXPRESS_RULES },
    'react-native': {
        imports: [
            "import reactNativePlatform from '@react-native/eslint-plugin';",
            "import reactNative from 'eslint-plugin-react-native';",
        ],
        plugins: "plugins: { '@react-native': reactNativePlatform, 'react-native': reactNative }",
        files: 'code',
        rules: REACT_NATIVE_RULES,
    },
    zod: {
        imports: ["import zodPlugin from 'eslint-plugin-zod';"],
        plugins: 'plugins: { zod: zodPlugin }',
        files: 'code',
        rules: Object.fromEntries(ZOD_RULES.map((rule) => [`zod/${rule}`, 'error'])),
    },
    translations: {
        imports: ["import i18next from 'eslint-plugin-i18next';"],
        plugins: 'plugins: { i18next }',
        files: JSX_FILES,
        ignores: 'testFiles',
        rules: TRANSLATIONS_RULES,
    },
};

export {
    VUE_RULES,
    NEXT_RULES,
    ASTRO_RULES,
    REACT_RULES,
    ASTRO_FILES,
    REFRESH_RULE,
    SVELTE_RULES,
    SVELTE_FILES,
    DRIZZLE_RULES,
    JSX_CODE_FILES,
    TABINDEX_RULES,
    FOCUSABLE_ROLES,
    NEXT_EXTRA_HOCS,
    TYPESCRIPT_RULES,
    NEXT_SERVER_FILES,
    NEXT_PAGES_FOLDERS,
    ASTRO_SCRIPT_FILES,
    JEST_GLOBAL_PACKAGE,
    NESTJS_ALL_LEVEL_RULES,
    ZUSTAND_STORE_CREATORS,
    TYPESCRIPT_TEST_RULES_OFF,
    PLUGIN_LINT_RULE_FRAGMENTS,
    NESTJS_INJECTABLE_FILTER_PATHS,
    TESTING_LIBRARY_DEFAULT_PRESET,
};
