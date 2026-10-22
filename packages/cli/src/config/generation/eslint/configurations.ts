import type { EslintPlugins } from '#cli/types/generation/eslint.ts';

/** Test correctness rules that the two test plugins share, without their namespace. */
export const TEST_RULE_NAMES = [
    'no-focused-tests',
    'no-disabled-tests',
    'no-identical-title',
    'no-standalone-expect',
    'no-commented-out-tests',
    'expect-expect',
    'valid-describe-callback',
    'no-conditional-expect',
    'valid-expect',
    'prefer-strict-equal',
] as const;

export const ASTRO_RULES = {
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

export const SVELTE_RULES = {
    'svelte/no-target-blank': 'error',
    'svelte/button-has-type': 'error',
    'svelte/no-useless-mustaches': 'error',
    'svelte/prefer-const': 'error',
} as const;

const TRANSLATIONS_RULES = { 'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }] } as const;

export const REACT_RULES = {
    'react/no-array-index-key': 'error',
    'react/self-closing-comp': 'error',
    'react/no-danger': 'error',
    'react/no-unstable-nested-components': 'error',
    'react/jsx-no-constructed-context-values': 'error',
    'react/no-object-type-as-default-prop': 'error',
} as const;

export const REACT_FILES = ['**/*.{js,jsx,ts,tsx}'] as const;

export const TYPESCRIPT_RULES = {
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

export const TYPESCRIPT_TEST_RULES = {
    'gspot/no-magic-numbers': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
} as const;

export const NESTJS_RULES = {
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
} as const;

export const NESTJS_INJECTABLE_FILTER_PATHS = [
    '/dist/',
    '/node_modules/',
    String.raw`\.test\.`,
    String.raw`\.spec\.`,
] as const;

export const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;

export const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;

export const REFRESH_RULE = 'react-refresh/only-export-components';

export const TABINDEX_RULES = [
    'jsx-a11y/no-noninteractive-tabindex',
    'astro/jsx-a11y/no-noninteractive-tabindex',
] as const;

/** Roles that may take tabIndex: a tab panel, as jsx-a11y allows, and a scrollable region that keyboards must reach. */
export const FOCUSABLE_ROLES = ['tabpanel', 'region'] as const;

/** Next.js higher-order components that react-refresh does not know: catchError from next/error, in Next.js 16.2. */
export const NEXT_EXTRA_HOCS = ['catchError'] as const;

export const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;

export const VUE_RULES = {
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-true-attribute-shorthand': 'error',
    'vue/no-unused-refs': 'error',
    'vue/require-typed-ref': 'error',
    'vue/html-button-has-type': 'error',
    'vue/no-template-target-blank': 'error',
} as const;

export const ASTRO_FILES = ['**/*.astro'] as const;

export const ASTRO_SCRIPT_FILES = ['**/*.astro/*.ts', '**/*.astro/*.js'] as const;

export const SVELTE_FILES = ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'] as const;

const JSX_FILES = ['**/*.{jsx,tsx}'] as const;

export const TESTING_LIBRARY_DEFAULT_PRESET = 'dom';

export const ZUSTAND_STORE_CREATORS = ['create', 'createStore'] as const;

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

export const DRIZZLE_RULES = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'] as const;

const JEST_GLOBAL_PACKAGE = '@jest/globals';

/** Imported bindings for the blocks of each configuration. */
export const CONFIGURATION_PLUGINS = {
    expo: { expoPlugin: ['expoPlugin', 'eslint-plugin-expo'] },
    'react-native': {
        reactNativePlatform: ['reactNativePlatform', '@react-native/eslint-plugin'],
        reactNative: ['reactNative', 'eslint-plugin-react-native'],
    },
    zod: { zodPlugin: ['zodPlugin', 'eslint-plugin-zod'] },
    translations: { i18next: ['i18next', 'eslint-plugin-i18next'] },
    nextjs: {
        nextPlugin: ['nextPlugin', '@next/eslint-plugin-next'],
        reactRefresh: ['reactRefresh', 'eslint-plugin-react-refresh'],
    },
    vue: {
        vuePlugin: ['vuePlugin', 'eslint-plugin-vue'],
        vueParser: ['vueParser', 'vue-eslint-parser'],
        vueAccessibility: ['vueAccessibility', 'eslint-plugin-vuejs-accessibility'],
    },
    'react-dom': { accessibility: ['accessibility', 'eslint-plugin-jsx-a11y'] },
    astro: { astroPlugin: ['astroPlugin', 'eslint-plugin-astro'] },
    zustand: {},
    svelte: {
        sveltePlugin: ['sveltePlugin', 'eslint-plugin-svelte'],
        svelteParser: ['svelteParser', 'svelte-eslint-parser'],
    },
    nestjs: { nestjsTyped: ['nestjsTyped', '@darraghor/eslint-plugin-nestjs-typed'] },
    'tanstack-query': { tanstackQuery: ['tanstackQuery', '@tanstack/eslint-plugin-query'] },
    vitest: { vitest: ['vitest', '@vitest/eslint-plugin'] },
    typescript: {
        tseslint: ['tseslint', 'typescript-eslint'],
        '{ createTypeScriptImportResolver }': [
            '{ createTypeScriptImportResolver }',
            'eslint-import-resolver-typescript',
        ],
    },
    'testing-library': { testingLibrary: ['testingLibrary', 'eslint-plugin-testing-library'] },
    react: {
        reactHooks: ['reactHooks', 'eslint-plugin-react-hooks'],
        react: ['react', 'eslint-plugin-react'],
        reactRefresh: ['reactRefresh', 'eslint-plugin-react-refresh'],
    },
    drizzle: { drizzlePlugin: ['drizzlePlugin', 'eslint-plugin-drizzle'] },
    jest: { jest: ['jest', 'eslint-plugin-jest'] },
} as const satisfies Record<string, EslintPlugins>;

/** The imports, plugins, files, and rules of the configuration blocks that need no code of their own. */
export const PLUGIN_RULE_BLOCKS: Readonly<
    Record<
        string,
        {
            imports: EslintPlugins;
            properties: string;
            files: 'code' | 'tests' | readonly string[];
            ignores?: 'tests';
            rules: Readonly<Record<string, unknown>>;
        }
    >
> = {
    jest: {
        imports: CONFIGURATION_PLUGINS.jest,
        properties: `plugins: { jest }, languageOptions: { globals: jest.environments.globals.globals }, settings: { jest: { globalPackage: ${JSON.stringify(JEST_GLOBAL_PACKAGE)} } }`,
        files: 'tests',
        rules: {
            ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`jest/${name}`, 'error'])),
            'jest/valid-expect': ['error', { maxArgs: 1 }],
        },
    },
    expo: {
        imports: CONFIGURATION_PLUGINS.expo,
        properties: 'plugins: { expo: expoPlugin }',
        files: 'code',
        rules: EXPO_RULES,
    },
    express: { imports: {}, properties: '', files: 'code', rules: EXPRESS_RULES },
    'react-native': {
        imports: CONFIGURATION_PLUGINS['react-native'],
        properties: "plugins: { '@react-native': reactNativePlatform, 'react-native': reactNative }",
        files: 'code',
        rules: REACT_NATIVE_RULES,
    },
    zod: {
        imports: CONFIGURATION_PLUGINS.zod,
        properties: 'plugins: { zod: zodPlugin }',
        files: 'code',
        rules: Object.fromEntries(ZOD_RULES.map((rule) => [`zod/${rule}`, 'error'])),
    },
    translations: {
        imports: CONFIGURATION_PLUGINS.translations,
        properties: 'plugins: { i18next }',
        files: JSX_FILES,
        ignores: 'tests',
        rules: TRANSLATIONS_RULES,
    },
};

/** Vue component files share one selector across captured and authored rule blocks. */
export const VUE_FILES = ['**/*.vue'] as const;

export const TESTING_LIBRARY_SCOPE = '@testing-library/';

/** Astro's processor exposes component return values without the typed service's return contract. */
export const ASTRO_TYPED_RULES = { '@typescript-eslint/no-unsafe-return': 'off' } as const;
