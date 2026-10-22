/** The source label of shared ESLint blocks. */
export const ESLINT_BASE_LABEL = 'javascript';

export const PACKAGE_JSON_PATTERN = '**/package.json';

export const PRESETS_AFTER_CONFIGURATIONS = [
    ['packageJson', 'packageJson'],
    ['prettier', 'prettierConfig'],
] as const;

export const PRESETS_BEFORE_CONFIGURATIONS = [
    ['eslint', 'eslint'],
    ['sonar', 'sonarjs'],
    ['unicorn', 'unicorn'],
] as const;

export const IMPORT_LAYOUT_RULES = {
    'import-x/first': 'error',
    'import-x/newline-after-import': ['error', { count: 1, considerComments: true }],
} as const;

export const BARREL_FILES_RULE = 'barrel-files/avoid-barrel-files';

/** Plugins that the shared JavaScript rule tables use. */
export const ESLINT_PLUGIN_IMPORTS = {
    gspot: ['gspot', '@gspothq/eslint-plugin'],
    'import-x': ['importX', 'eslint-plugin-import-x'],
    jsdoc: ['jsdoc', 'eslint-plugin-jsdoc'],
    n: ['nodePlugin', 'eslint-plugin-n'],
    regexp: ['regexp', 'eslint-plugin-regexp'],
    security: ['security', 'eslint-plugin-security'],
} as const;

export const ESLINT_LIMIT_RULES = {
    'max-lines': { limit: 'file_lines', options: { skipBlankLines: true, skipComments: true } },
    'max-lines-per-function': {
        limit: 'function_lines',
        options: { skipBlankLines: true, skipComments: true, IIFEs: true },
    },
    'max-params': { limit: 'function_parameters', options: { countVoidThis: false } },
    'max-depth': { limit: 'block_nesting' },
    'max-statements': { limit: 'function_statements' },
    'max-nested-callbacks': { limit: 'callback_nesting' },
    complexity: { limit: 'cyclomatic_complexity' },
    'sonarjs/cognitive-complexity': { limit: 'cognitive_complexity' },
} as const;

export const RUNTIME_GLOBALS: Readonly<Record<string, string>> = { node: 'nodeBuiltin', commonjs: 'node' };

export const NODE_RUNTIMES: readonly string[] = ['node', 'nodeBuiltin', 'commonjs'] as const;

/** Plugins loaded by the all level and its permitted barrel exports. */
export const LEVEL_ALL_PLUGIN_IMPORTS = {
    perfectionist: ['perfectionist', 'eslint-plugin-perfectionist'],
    'barrel-files': ['barrelFiles', 'eslint-plugin-barrel-files'],
} as const;

/** The boundaries plugin accompanies emitted dependency policies. */
export const BOUNDARIES_PLUGIN_IMPORT = { boundaries: ['boundaries', 'eslint-plugin-boundaries'] } as const;

/** The plugin prefix of a rule name, such as `n` in `n/no-process-exit`; a core rule has none. */
export const RULE_PLUGIN_PREFIX = /^(?<prefix>.+)\/[^/]+$/u;
