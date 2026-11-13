import { JSON_INDENT } from '#cli/config/tools/programs.ts';

// generated config
export const BOUNDARIES_PLUGIN_PACKAGE = 'eslint-plugin-boundaries';
export const CONFIGURATION_BLOCKS_SUFFIX = 'Blocks';
export const ESLINT_CHECK = 'javascript/eslint';
export const ESLINT_CONFIG_API = 'eslint/config';
export const ESLINT_FIXES_FILE = 'fixes.mjs';
export const ESLINT_FUNCTIONS_FILE = 'functions.mjs';
export const ESLINT_PLUGIN_PACKAGES = [
    '@gspothq/eslint-plugin',
    'eslint-plugin-import-x',
    'eslint-plugin-jsdoc',
    'eslint-plugin-n',
    'eslint-plugin-regexp',
    'eslint-plugin-security',
] as const;
export const LEVEL_ALL_PLUGIN_PACKAGE = 'eslint-plugin-perfectionist';
export const UNICORN_PLUGIN_PACKAGE = 'eslint-plugin-unicorn';

// block printing
export const EMPTY_LIST = '[]';
export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);
export const ESLINT_NAMED_IMPORTS: Readonly<Record<string, string | undefined>> = {
    'eslint-import-resolver-typescript': 'createTypeScriptImportResolver',
    [ESLINT_CONFIG_API]: 'defineConfig',
};
export const ESLINT_PACKAGE_IMPORTERS: Readonly<Record<string, string | undefined>> = {
    'eslint-plugin-astro': 'importAstroPlugin',
    'svelte-eslint-parser': 'importSvelteParser',
};
export const ESLINT_RUNTIMES_CONSTANT = 'runtimeDeclarations';
export const GSPOT_PRESET_LEVELS = { basic: 'recommended', all: 'all' } as const;
export const IDENTIFIER_SEPARATOR = /[^\w$]/gu;
export const NAME_SEPARATOR = /[-/.](?<letter>[a-z0-9])/gu;
export const PACKAGE_SCOPE_MARK = /^@/u;
export const SHARED_LIST_MARK = '@shared:';
export const SHARED_LIST_REFERENCE = /"@shared:(?<name>\w+)"/gu;
export const SHARED_LIST_SUFFIX = 'List';

// config plan
export const BOUNDARY_FOLDERS_CONSTANT = 'importBoundaryFolders';
export const DEFAULT_PROJECT_FILES = ['**/*.config.{ts,mts,cts}', '**/scripts/*.ts'] as const;
