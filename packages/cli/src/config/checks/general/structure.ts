// The literal values checks/general/structure reads: names, patterns, limits, and tables.
import { TOML_STRINGS } from '#cli/config/checks/checks.ts';
import type { GrammarName } from '#cli/types/parsers/parsers.ts';
import { EXTENSION_TAGS } from '#cli/config/repository/repository.ts';

export const POLICY_FILE = 'gspot.toml';
/** The script language of each extension the tags call TypeScript or JavaScript. */
export const LANGUAGE_BY_EXTENSION: Record<string, string> = Object.fromEntries(
    Object.entries(EXTENSION_TAGS).flatMap(([extension, tags]) =>
        ['typescript', 'javascript']
            .filter((language) => tags.includes(language))
            .map((language) => [extension, language]),
    ),
);
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
export const CONFIG_IMPORT_PREFIXES = ['#config/'];

export const FUNCTION_NODES = new Set([
    'function_definition',
    'function_declaration',
    'init_declaration',
    'deinit_declaration',
    'lambda',
    'lambda_literal',
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
]);
export const TYPE_ALIASES = new Set(['type_alias_statement', 'typealias_declaration']);
export const CONTAINER_NODES = new Set([
    'decorated_definition',
    'class_definition',
    'class_declaration',
    'class_body',
    'block',
    'source_file',
    'module',
    'program',
    'computed_property',
]);
export const CONTAINER_NOISE = new Set([
    'identifier',
    'type_identifier',
    'modifiers',
    'decorator',
    'inheritance_specifier',
]);
export const NAMES = new Set(['identifier', 'simple_identifier', 'attribute', 'navigation_expression']);
export const TYPE_REFERENCES = new Set(['type', 'user_type', 'identifier', 'type_identifier']);

export const GSPOT_DIRECTORY = '.gspot/';

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

/** Git names its hooks, so the hook directories may hold pre-commit beside pre-push. */
export const STRUCTURE_HOOK_DIRECTORIES = ['.gspot/hooks', '.githooks', '.husky', '.mise/tasks/hook'];
export const HOOK_PREFIX = 'pre';

/** Documentation extensions: the folder analyses judge code, and a collection of one page per topic is a layout, not a smell. */
export const DOCUMENT_EXTENSIONS = ['.md', '.mdx'];

/** Dependency installations and Git metadata do not contain authored project structure. */
export const IGNORED_FOLDERS = ['node_modules', '.git'];

export const PREFIX_COLLISIONS = 2;
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

/** The comment syntax of each source extension, which the suppression check reads. */
export const COMMENT_STYLE_BY_EXTENSION: Record<string, 'slash' | 'hash' | 'dash' | 'html'> = {
    '.ts': 'slash',
    '.mts': 'slash',
    '.cts': 'slash',
    '.tsx': 'slash',
    '.js': 'slash',
    '.mjs': 'slash',
    '.cjs': 'slash',
    '.jsx': 'slash',
    '.swift': 'slash',
    '.css': 'slash',
    '.scss': 'slash',
    '.py': 'hash',
    '.sh': 'hash',
    '.bash': 'hash',
    '.zsh': 'hash',
    '.toml': 'hash',
    '.yml': 'hash',
    '.yaml': 'hash',
    '.sql': 'dash',
    '.pgsql': 'dash',
    '.psql': 'dash',
    '.md': 'html',
    '.html': 'html',
    '.htm': 'html',
};
export const COMMENT_OPENERS: Record<string, string[]> = {
    slash: ['//', '/*'],
    hash: ['#'],
    dash: ['--'],
    html: ['<!--'],
};

export const COMMENT_GRAMMARS = new Map<string, GrammarName>([
    ['.py', 'python'],
    ['.sh', 'bash'],
    ['.bash', 'bash'],
    ['.zsh', 'bash'],
    ['.swift', 'swift'],
    ['.html', 'html'],
    ['.htm', 'html'],
    ['.md', 'html'],
    ['.css', 'css'],
]);

// The pieces of a TOML file: a string, a comment to the end of the line, or a run of anything else.
export const TOML_TOKENS = new RegExp(String.raw`${TOML_STRINGS.source}|#[^\n]*|[^"'#]+|["']`, 'gu');
