import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { FOREIGN_HOOK_FOLDERS } from '#cli/config/repository/repository.ts';

export const BARE_BLOCK_RULE = 'bare-block';

export const BARE_BLOCK_MESSAGE =
    'A do block without catch hides a step. Name the step as a function, or remove the do.';

export const UNNAMED_VARIABLE_LABEL = 'An environment variable';

export const READ_OUTSIDE_READER_RULE = 'read-outside-reader';

export const FILE_FOLDER_CLASH_RULE = 'file-folder-clash';

export const CONFIG_FILE_PATTERNS = ['**/*.config.*', '**/.*rc.*', '**/Package.swift', '**/setup.py'] as const;

export const IMPORT_RULE_EXTENSIONS = [
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.py',
    '.pyi',
    '.swift',
] as const;

export const UNCOVERED_FILE_MESSAGE =
    'No [[import_rule]] covers this file. Add a path that matches it to an import rule, or record an [[ignore]] for structure/import-rules with its paths and a reason.';

export const PYTHON_SOURCE_ROOTS = ['', 'src'] as const;

export const PYTHON_EXTENSIONS = ['.py', '.pyi'] as const;

export const IMPORT_RULES_SKIP = 'Add [[import_rule]] records to check imports.';

export const PYTHON_MODULE_SUFFIXES = ['.py', '.pyi', '/__init__.py', '/__init__.pyi'] as const;

export const PYTHON_IMPORT_STATEMENT = 'import_statement';

export const PYTHON_FROM_STATEMENT = 'import_from_statement';

export const RELATIVE_IMPORT = 'relative_import';

export const IMPORT_RULE_CHECK_RULES = { uncoveredFile: 'uncovered-file', refusedImport: 'refused-import' } as const;

export const LONE_FILE_RULE = 'lone-file';

export const FILE_LINES_RULE = 'file-lines';

export const LANGUAGE_BY_EXTENSION = { '.py': 'python', '.swift': 'swift' } as const;

export const SOURCE_QUERIES = {
    bash: `(function_definition) @function
(variable_assignment) @assignment`,
    python: '(function_definition) @function',
    swift: `[(function_declaration body: (function_body)) (init_declaration) (deinit_declaration) (computed_getter)
(computed_setter) (computed_property (statements)) (willset_clause) (didset_clause)] @function
(do_statement) @block`,
} as const;

export const PASS_THROUGH_FOLDER_RULE = 'pass-through-folder';

export const SPEC_SUFFIX = /\.spec$/u;

const MISE_HOOKS_PATH = '.mise/tasks/hook';

export const HOOK_FOLDERS = [GSPOT_PATHS.hooks, MISE_HOOKS_PATH, ...FOREIGN_HOOK_FOLDERS] as const;

export const INDEX_BASE_NAMES = new Set(['index', 'mod', '__init__']);

export const COMPANION_SUFFIX = /\.(?:test|spec|stories|story|module|styles?|mock|bench)$/u;

export const SHARED_PREFIX_RULE = 'shared-prefix';

export const SWIFTPM_TARGET_FOLDERS: Readonly<Record<string, readonly string[]>> = {
    target: ['Sources', 'Source', 'src', 'srcs'],
    executableTarget: ['Sources', 'Source', 'src', 'srcs'],
    macro: ['Sources', 'Source', 'src', 'srcs'],
    testTarget: ['Tests', 'Sources', 'Source', 'src', 'srcs'],
    plugin: ['Plugins'],
};

export const NON_WORD_CHARACTERS = /\W/gu;

export const BASH_COMMAND_NODES: ReadonlySet<string> = new Set(['command', 'declaration_command']);

export const PYTHON_EXPORT_LIST = '__all__';

export const BARE_NAME_NODES = new Set(['identifier', 'simple_identifier', 'attribute', 'navigation_expression']);

export const BASH_SOURCE_COMMANDS: ReadonlySet<string> = new Set(['source', '.']);

export const FORWARDING_NODES: ReadonlySet<string> = new Set(['future_import_statement', 'hash_bang_line']);

export const TYPE_ALIAS_NODES = new Set(['type_alias_statement', 'typealias_declaration']);

export const TYPE_REFERENCE_NODES = new Set(['type', 'user_type', 'identifier', 'type_identifier']);

export const COUNTED_FUNCTION_NODES = new Set([
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

export const SWIFT_ACCESSOR_OWNERS: ReadonlySet<string> = new Set(['property_declaration', 'subscript_declaration']);

export const SWIFT_FUNCTION_LABELS: Readonly<Record<string, string>> = {
    init_declaration: 'init',
    deinit_declaration: 'deinit',
    lambda_literal: 'closure',
    computed_getter: 'getter',
    computed_setter: 'setter',
    computed_property: 'getter',
    willset_clause: 'willSet observer',
    didset_clause: 'didSet observer',
};

export const SWIFT_ACCESSOR_NODES = new Set([
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
]);

export const FUNCTION_LABEL = 'function';

export const ONE_STATEMENT = '1 statement';

export const TRIVIAL_FILE_MESSAGE =
    'This file only imports, re-exports, or renames code. Import from the module that defines it, and delete this file.';

export const TRIVIAL_FUNCTION_RULES = { trivialFunction: 'trivial-function', trivialFile: 'trivial-file' } as const;

export const FUNCTION_ORDER_RULE = 'private-below-public';

export const SCRIPT_FUNCTION_DECLARATIONS: ReadonlySet<string> = new Set([
    'function_declaration',
    'generator_function_declaration',
]);

export const SCRIPT_FUNCTION_VALUES: ReadonlySet<string> = new Set([
    'arrow_function',
    'function_expression',
    'generator_function',
]);

export const DEFAULT_EXPORT_NAME = 'default';

export const PRIVATE_SWIFT_VISIBILITIES: ReadonlySet<string> = new Set(['private', 'fileprivate']);
