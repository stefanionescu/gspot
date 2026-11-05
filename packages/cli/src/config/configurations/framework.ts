import { TYPE } from '@formatjs/icu-messageformat-parser';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';

export const TSCONFIG_COPY_FOLDER = `${GSPOT_PATHS.configurations}/language/typescript`;

export const TYPESCRIPT_TAG = 'typescript';

export const FAILED_CHECK_LINE = /^✖ (?<description>.+)$/u;

export const PASSED_CHECKS_LINE = /^\d+\/\d+ checks passed\./u;

export const EXPO_PACKAGE = 'expo';

export const EXPO_DOCTOR_COMMAND = ['expo-doctor'] as const;

export const BLOCK_END_PREFIXES = ['Advice:', '✔ ', '✖ '] as const;

export const UNINSTALLED_EXPO_MESSAGE =
    'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.';

export const FAILED_CHECK_RULE = 'failed-check';

export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'] as const;

export const SHOWN_LINES = 3;

export const MARKED_LINES = 2;

export const NEXT_TYPEGEN_COMMAND = ['next', 'typegen'] as const;

export const ASSET_GLOB_CALL = 'import.meta.glob';

export const NEXT_PACKAGE = 'next';

export const CI_ENVIRONMENT = { CI: '1' } as const;

export const REACT_PACKAGE = 'react';

export const REACT_DOM_PACKAGE = 'react-dom';

export const REACT_VERSIONS_RULE = 'react-versions';

export const FINDING_LINE = /^\d+ (?<message>\{.*\})$/u;

export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;

export const SVELTE_CHECK_COMMAND = [
    'svelte-check',
    '--workspace',
    '.',
    '--output',
    'machine-verbose',
    '--fail-on-warnings',
] as const;

export const SVELTE_TSCONFIG_FLAG = '--tsconfig';

export const SVELTE_CHECK_RULE = 'svelte-check';

export const UNBUILT_SITE_NOTE = 'The site did not build.';

export const BUILD_RULE = 'build';

export const SITEMAP_LOCATION = /<loc>(?:\s*<!\[CDATA\[(?<cdata>[\s\S]*?)\]\]>\s*|(?<url>[^<]*))<\/loc>/gu;

export const SITEMAP_EXTENSION = '.xml';

export const SITEMAP_FILE = /^sitemap.*\.xml$/u;

export const INDEX_PAGE = 'index.html';

export const HTML_EXTENSION = '.html';

export const LYCHEE_TOOL = 'lychee';

export const LYCHEE_ARGUMENTS = [
    '--offline',
    '--include-fragments',
    '--index-files',
    'index.html',
    '--fallback-extensions',
    'html',
    '--format',
    'detailed',
    '--no-progress',
] as const;

export const HTML_VALIDATE_TOOL = 'html-validate';

export const HTML_VALIDATE_CONFIG_FLAG = '--config';

export const HTML_VALIDATE_FORMATTER_FLAG = '--formatter';

export const HTML_VALIDATE_OUTPUT = 'html-validate.json';

export const CSS_EXTENSION = '.css';

export const PURGECSS_PROCESS = 'purgecss-process';

export const PURGECSS_CONTENT = ['**/*.html', '**/*.js'] as const;

export const STYLE_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less']);

export const STYLE_COMPONENTS = new Set(['.astro', '.vue', '.svelte']);

export const STYLE_WHITESPACE = /\s+/gu;

export const STYLE_SCOPING = /:where\(\.astro-[a-z\d-]+\)|\[data-(?:astro-cid|v)-[a-z\d-]+\]|\.svelte-[a-z\d-]+/giu;

export const ROOT_FOLDER_FLAG = '--root-dir';

export const REMAP_FLAG = '--remap';

export const EXCLUDE_FLAG = '--exclude';

export const UNLISTED_PAGE_MESSAGE = 'The build wrote this page, and the sitemap does not list it.';

export const SITE_RULES = {
    unusedSelector: 'unused-selector',
    missingPage: 'missing-page',
    unlistedPage: 'unlisted-page',
    invalidUrl: 'invalid-url',
} as const;

export const PURGECSS_TOOL = 'purgecss';

export const TEXT_EXTENSIONS = new Set([
    '.htm',
    '.html',
    '.css',
    '.scss',
    '.js',
    '.mjs',
    '.jsx',
    '.ts',
    '.tsx',
    '.astro',
    '.vue',
    '.svelte',
    '.json',
    '.webmanifest',
    '.xml',
    '.txt',
    '.md',
    '.mdx',
    '.cjs',
    '.mts',
    '.cts',
    '.less',
    '.sass',
    '.styl',
    '.njk',
    '.liquid',
    '.hbs',
    '.ejs',
    '.pug',
    '.toml',
    '.yml',
    '.yaml',
]);

export const ASSET_FOLDER = /(?:^|\/)(?:assets|public|static)\//u;

export const UNUSED_ASSET_RULE = 'unused-asset';

export const UNUSED_ASSET_MESSAGE = 'No page, stylesheet or script names this file.';

export const CONVENTIONAL_ASSETS =
    /(?:^|\/)(?:favicon\.ico|apple-touch-icon[^/]*\.png|CNAME|\.nojekyll|\.well-known\/.*)$/u;

export const ASSET_REFERENCE_PREFIX = String.raw`(?<![\w./-])`;

export const ASSET_REFERENCE_SUFFIX = String.raw`(?=$|[^\w./-])`;

export const ALIAS_WILDCARD_SIDES = 2;

export const REACT_RULES = {
    '@eslint-react/no-missing-component-display-name': 'error',
    '@eslint-react/no-array-index-key': 'error',
    '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
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

export const VUE_SCOPE_RULES = { 'vue/require-default-prop': 'off' } as const;

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

export const DRIZZLE_RULES = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'] as const;

export const TESTING_LIBRARY_SCOPE = '@testing-library/';

export const TESTING_LIBRARY_DEFAULT_PRESET = 'dom';

export const TESTING_LIBRARY_SETTINGS = {
    'testing-library/utils-module': 'off',
    'testing-library/custom-renders': 'off',
    'testing-library/custom-queries': 'off',
} as const;

export const TESTING_LIBRARY_PRESETS: readonly string[] = ['angular', 'dom', 'marko', 'react', 'svelte', 'vue'];

export const ZUSTAND_STORE_IMPORTS = [
    { name: 'zustand', importNames: ['create', 'createStore'] },
    { name: 'zustand/vanilla', importNames: ['createStore'] },
] as const;

export const CREATE_STORE_MESSAGE =
    'Create stores only in the files of `zustand.store_files`, inside a factory that a provider owns.';

export const NON_PYTHON_TEST_PATTERNS: ReadonlySet<string> = new Set([
    '**/*.test.*',
    '**/*.spec.*',
    '**/*Tests.swift',
    '**/__tests__/**',
]);

export const MESSAGE_FILE_SUFFIX = '.json';

export const ARGUMENT_FORMATS = {
    [TYPE.argument]: '',
    [TYPE.number]: ', number',
    [TYPE.date]: ', date',
    [TYPE.time]: ', time',
} as const;

export const EMPTY_MESSAGE = 'The message is empty.';

export const PLURAL_FORMAT = ', plural';

export const TRANSLATION_RULES = {
    extraKey: 'extra-key',
    baseLocale: 'base-locale',
    message: 'message',
    missingKey: 'missing-key',
    messageArguments: 'message-arguments',
} as const;

export const REACT_NATIVE_CONFIGURATION = 'react-native';

export const TYPESCRIPT_CONFIGURATION = 'typescript';
