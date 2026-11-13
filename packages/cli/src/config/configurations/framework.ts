// react-dom generated config

const FOCUSABLE_ROLES = ['tabpanel', 'region'] as const;
export const REACT_DOM_RULE_OPTIONS = { 'jsx-a11y-x/no-noninteractive-tabindex': { roles: [...FOCUSABLE_ROLES] } };

// astro generated config
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

// expo checks
export const BLOCK_END_PREFIXES = ['Advice:', '✔ ', '✖ '] as const;
export const EXPO_DOCTOR_COMMAND = ['expo-doctor'] as const;
export const EXPO_PACKAGE = 'expo';
export const FAILED_CHECK_LINE = /^✖ (?<description>.+)$/u;
export const FAILED_CHECK_RULE = 'failed-check';
export const PASSED_CHECKS_LINE = /^\d+\/\d+ checks passed\./u;
export const UNINSTALLED_EXPO_MESSAGE =
    'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.';

// nestjs generated config
export const NESTJS_INJECTABLE_FILTER_PATHS = [
    '/dist/',
    '/node_modules/',
    String.raw`\.test\.`,
    String.raw`\.spec\.`,
] as const;
export const NESTJS_RULES = {
    '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
} as const;
export const SWAGGER_PACKAGE = '@nestjs/swagger';
export const TS_PATTERN = '**/*.ts';

// react-dom checks
export const REACT_DOM_PACKAGE = 'react-dom';
export const REACT_PACKAGE = 'react';
export const REACT_VERSIONS_RULE = 'react-versions';

// svelte checks
export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;
export const FINDING_LINE = /^\d+ (?<message>\{.*\})$/u;
export const SVELTE_CHECK_COMMAND = [
    'svelte-check',
    '--workspace',
    '.',
    '--output',
    'machine-verbose',
    '--fail-on-warnings',
] as const;
export const SVELTE_CHECK_RULE = 'svelte-check';
export const SVELTE_TSCONFIG_FLAG = '--tsconfig';

// svelte generated config
export const SVELTE_FILES = ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.ts'] as const;
export const SVELTE_RULES = {
    'svelte/no-target-blank': 'error',
    'svelte/button-has-type': 'error',
    'svelte/no-useless-mustaches': 'error',
    'svelte/prefer-const': 'error',
} as const;

// vue generated config
export const VUE_FILES = ['**/*.vue'] as const;
export const VUE_RULES = {
    'vue/no-setup-props-reactivity-loss': 'error',
    'vue/no-ref-object-reactivity-loss': 'error',
    'vue/component-api-style': ['error', ['script-setup']],
    'vue/no-useless-v-bind': 'error',
    'vue/prefer-true-attribute-shorthand': 'error',
    'vue/no-unused-refs': 'error',
    'vue/require-typed-ref': 'error',
    'vue/html-button-has-type': 'error',
    'vue/no-template-target-blank': 'error',
} as const;
export const VUE_SCOPE_RULES = { 'vue/require-default-prop': 'off' } as const;
