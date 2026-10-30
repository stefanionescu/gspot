export const REACT_RULES = {
    '@eslint-react/no-missing-component-display-name': 'error',
    '@eslint-react/no-array-index-key': 'error',
    '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    '@eslint-react/no-nested-component-definitions': 'error',
    '@eslint-react/no-unstable-context-value': 'error',
    '@eslint-react/no-unstable-default-props': 'error',
} as const;

const FOCUSABLE_ROLES = ['tabpanel', 'region'] as const;

export const REACT_DOM_RULE_OPTIONS = { 'jsx-a11y-x/no-noninteractive-tabindex': { roles: [...FOCUSABLE_ROLES] } };

export const ASTRO_FILES = ['**/*.astro'] as const;

export const ASTRO_RULES = {
    'astro/no-set-html-directive': 'error',
    'astro/no-exports-from-components': 'error',
    'astro/no-prerender-export-outside-pages': 'error',

    'astro/no-unused-css-selector': 'error',
    'astro/prefer-class-list-directive': 'error',
    'astro/prefer-object-class-list': 'error',
    'astro/prefer-split-class-list': 'error',
} as const;

export const ASTRO_RULE_OPTIONS = { 'astro/jsx-a11y/no-noninteractive-tabindex': { roles: [...FOCUSABLE_ROLES] } };

export const ASTRO_TYPED_RULES = { '@typescript-eslint/no-unsafe-return': 'off' } as const;

export const ASTRO_SCRIPT_FILES = ['**/*.astro/*.ts', '**/*.astro/*.js'] as const;

export const NESTJS_RULES = {
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
} as const;

export const NESTJS_INJECTABLE_FILTER_PATHS = [
    '/dist/',
    '/node_modules/',
    String.raw`\.test\.`,
    String.raw`\.spec\.`,
] as const;

export const SWAGGER_PACKAGE = '@nestjs/swagger';

export const TS_PATTERN = '**/*.ts';

export const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;

export const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;

export const NEXT_RULE_OPTIONS = { 'react-refresh/only-export-components': { extraHOCs: ['catchError'] } };

export const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;

export const REACT_FILES = ['**/*.{js,jsx,ts,tsx}'] as const;

export const SVELTE_FILES = ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'] as const;

export const SVELTE_RULES = {
    'svelte/no-target-blank': 'error',
    'svelte/button-has-type': 'error',
    'svelte/no-useless-mustaches': 'error',
    'svelte/prefer-const': 'error',
} as const;

export const VUE_FILES = ['**/*.vue'] as const;

export const VUE_RULES = {
    'vue/require-default-prop': 'off',
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-true-attribute-shorthand': 'error',
    'vue/no-unused-refs': 'error',
    'vue/require-typed-ref': 'error',
    'vue/html-button-has-type': 'error',
    'vue/no-template-target-blank': 'error',
} as const;
