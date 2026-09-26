// The literal values checks/structure reads: names, patterns, limits, and tables.

export const RULES: Record<string, { limit: string; noun: string; isDepth: boolean }> = {
    'bash-branches': { limit: 'function_branches', noun: 'branches', isDepth: false },
    'bash-nesting': { limit: 'function_nesting', noun: 'levels of nesting', isDepth: true },
    'bash-mutable-assignments': { limit: 'mutable_assignments', noun: 'assignments', isDepth: false },
};
export const OUTER_LEVELS = 2;
export const FUNCTIONS = new Set([
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
export const CONTAINERS = new Set([
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
export const DEFAULT_MIN_LINES = 3;
export const IDENTIFIER = /[A-Za-z_]\w*/gu;
export const SHELLCHECK_COMMENT = /^#\s*shellcheck\b/u;
export const WORD = /[A-Za-z0-9]+/gu;
export const COUNT_ANALYSES = new Set(['bash-branches', 'bash-nesting', 'bash-mutable-assignments']);
export const SCRIPT_TAG = 'shell';
export const GSPOT_DIRECTORY = '.gspot/';
export const SOURCE = /\.[cm]?[jt]sx?$/u;
export const IMPORT_KINDS = new Set(['import-statement', 'require-call', 'dynamic-import']);
export const CALL = /^([A-Za-z_]\w*)\b(.*)$/u;
export const OPERATORS = [' && ', ' || ', ' | ', ';'];
/** The start of a computed directory constant, and the three signs that mark one. */
export const DIRECTORY_CONSTANT_START = /^[A-Z_][A-Z0-9_]*=/u;
export const DIRECTORY_CONSTANT_SIGNS = ['cd', 'BASH_SOURCE[0]', 'pwd'];
/** Functions every script may leave uncalled. */
export const ENTRY_FUNCTIONS = ['main', 'run_step'];
/** Words that say nothing in a function summary. */
export const VAGUE_SUMMARY_WORDS = [
    'a',
    'an',
    'and',
    'do',
    'does',
    'execute',
    'executes',
    'handle',
    'handles',
    'perform',
    'performs',
    'run',
    'runs',
    'the',
];
/** The doc sections a function comment may carry, in the order they go. */
export const BASH_DOC_SECTIONS = ['# Globals:', '# Arguments:', '# Outputs:', '# Returns:'];
/** A positional parameter read, bare or braced. */
export const POSITIONAL_PARAMETERS = [/(?:^|[^$])\$(?:[1-9]|[@*#])/u, /\$\{(?:[1-9]|[@*#])[:}]/u];
/** Tokens that end the argument list of a call. */
export const CALL_ENDINGS = ['&&', '||', '|', ';', ';;', 'then', 'do', 'fi', 'done', ')'];
/** A flow keyword that may precede a call on the same line. */
export const FLOW_PREFIX = /^(?:if|then|elif|while|until|for|do|time|!)\s+/u;
/** Folder names that say nothing about what the folder holds. */
export const BANNED_FOLDER_NAMES = [
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
/** Folders no analysis looks into. */
export const IGNORED_FOLDERS = ['node_modules', 'dist', 'build', 'coverage', '.git'];
export const QUOTES = new Set(["'", '"']);
export const DECLARATION_WORDS = new Set(['readonly', 'export', 'declare', 'local']);
export const DEFAULT_THRESHOLD = 2;
export const NEST_KINDS = new Set([
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
export const TOOL_PREFIXES = new Set(['tsconfig', 'jsconfig', 'vitest', 'vite', 'docker', 'eslint', 'playwright']);
