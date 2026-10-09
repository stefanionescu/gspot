import type { CountedLanguage } from '#cli/types/parsers/statements.ts';
import type { CommentStyle, EnvironmentKind } from '#cli/types/checks/general/structure.ts';

/** Native declarations and reads used by the four source convention checks. */
export const HOUSE_QUERIES: Record<CountedLanguage, string> = {
    bash: `(function_definition) @function
(function_definition name: (word) @name (#eq? @name "main")) @entrypoint
(command) @import
(comment) @comment
(variable_assignment) @assignment
[(simple_expansion (variable_name) @read) (expansion (variable_name) @read)]`,
    python: `(function_definition) @function
[(import_statement) (import_from_statement) (future_import_statement)] @import
(comment) @comment
[(attribute) (call) (identifier)] @read
(attribute object: (identifier) attribute: (identifier) @environment_name
(#eq? @environment_name "environ")) @environment
(call function: (attribute object: (identifier) attribute: (identifier) @getter_name
(#eq? @getter_name "getenv")) @environment)
[(assignment) (for_statement) (function_definition) (class_definition) (parameters)] @binding`,
    swift: `[(function_declaration body: (function_body)) (init_declaration) (deinit_declaration) (computed_getter)
(computed_setter) (computed_property (statements)) (willset_clause) (didset_clause)] @function
[(class_declaration) (protocol_declaration) (function_declaration)
(property_declaration) (typealias_declaration)] @declaration
(import_declaration) @import
[(comment) (multiline_comment)] @comment
(navigation_expression) @read`,
};

/** Only these native os members read the process environment. */
export const OS_ENVIRONMENT_MEMBERS: Record<string, EnvironmentKind> = { environ: 'environ', getenv: 'getenv' };

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

export const INDEX_STEMS = new Set(['index', 'mod', '__init__']);

/** Comment styles for the languages whose code lines gspot counts. */
export const COMMENT_STYLE_BY_EXTENSION: Record<string, CommentStyle> = {
    '': ['bash', '#'],
    '.sh': ['bash', '#'],
    '.bash': ['bash', '#'],
    '.zsh': ['bash', '#'],
    '.bats': ['bash', '#'],
    '.py': ['python', '#'],
    '.pyi': ['python', '#'],
    '.sql': ['sql', '--'],
    '.pgsql': ['sql', '--'],
    '.psql': ['sql', '--'],
};

/** Test-file suffixes understood by JavaScript and TypeScript runners. */
export const TEST_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

/** Imported assertion bindings belong with test code. */
export const ASSERTION_MODULES = new Set(['bun:test', 'vitest', '@jest/globals']);

/** Conventional test folders can contain test files and assertion modules. */
export const TEST_DIRECTORIES = ['**/tests/**', '**/__tests__/**', '**/test/**'];
