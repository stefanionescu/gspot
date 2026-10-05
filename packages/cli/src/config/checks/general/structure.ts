/** Dependency installations and Git metadata do not contain authored project structure. */

/** Documentation extensions: the folder analyses judge code, and a collection of one page per topic is a layout, not a smell. */
export const DOCUMENT_EXTENSIONS = ['.md', '.mdx'];

export const CONFIG_STATEMENTS = new Set([
    'import_statement',
    'export_statement',
    'lexical_declaration',
    'type_alias_declaration',
    'comment',
    'empty_statement',
]);

export const CONFIG_LOGIC_NODES = new Set([
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
    'arrow_function',
    'class_declaration',
    'if_statement',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'try_statement',
    'await_expression',
    'ternary_expression',
]);

export const CONFIG_CALL_ALLOWED = new Set(['Set', 'Map', 'RegExp']);

/** Folder names that say nothing about what the folder holds. */
export const BANNED_FOLDERS = [
    'common',
    'core',
    'helper',
    'helpers',
    'util',
    'utils',
    'support',
    'misc',
    'shared',
    'bash',
    'javascript',
    'typescript',
    'python',
    'swift',
    'node',
    'js',
    'ts',
    'py',
    'sh',
];

export const NESTJS_KINDS = new Set([
    'controller',
    'service',
    'module',
    'guard',
    'pipe',
    'filter',
    'interceptor',
    'middleware',
    'decorator',
    'gateway',
    'resolver',
    'repository',
    'entity',
    'dto',
    'strategy',
    'provider',
]);

export const SCRIPT_ENDING = /\.[cm]?[jt]s$/u;

export const INDEX_STEMS = new Set(['index', 'mod', '__init__']);

// A tool names these files and finds them by that name, so a folder holds several of them by design.
export const TOOL_PREFIXES = new Set([
    'tsconfig',
    'jsconfig',
    'vitest',
    'vite',
    'docker',
    'eslint',
    'playwright',
    'package',
    'pnpm',
]);
