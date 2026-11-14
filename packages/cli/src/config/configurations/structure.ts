import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { ParsedLanguage } from '#cli/types/parsers.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { TYPE_NODES } from '#cli/config/configurations/general.ts';
import { KEPT_DOT_FILE, FOREIGN_HOOK_FOLDERS } from '#cli/config/repository/setup.ts';

// bare-blocks check
export const BARE_BLOCK_MESSAGE =
    'A do block without catch hides a step. Name the step as a function, or remove the do.';
export const BARE_BLOCK_RULE = 'bare-block';

// empty-folders check
export const EMPTY_FOLDER_RULE = 'empty-folder';
export const NO_EMPTY_FOLDERS_FLAG = '--no-empty-directory';
export const PLACEHOLDER_FILES: ReadonlySet<string> = new Set([KEPT_DOT_FILE, '.keep']);
// Git lists a folder with untracked files under both forms of this command, and an empty one only without the flag.
export const UNTRACKED_FOLDERS_ARGUMENTS = ['ls-files', '--others', '--directory', '--exclude-standard', '-z'] as const;

// environment-readers check
export const READ_OUTSIDE_READER_RULE = 'read-outside-reader';
export const UNNAMED_VARIABLE_LABEL = 'An environment variable';

// file-folder-clashes check
export const FILE_FOLDER_CLASH_RULE = 'file-folder-clash';
export const GSPOT_FIXED_NAMES: ReadonlySet<string> = new Set([SETTINGS_FILE]);

// function-order check
export const DEFAULT_EXPORT_NAME = 'default';
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
export const TEST_CALL_NAMES: ReadonlySet<string> = new Set(['describe', 'it', 'test']);

// import-rules check
export const CAPITALIZED_NAME = /^\p{Lu}/u;
export const CONFIG_PATTERNS = ['**/*.config.*', '**/.*rc.*', '**/Package.swift', '**/setup.py'] as const;
export const DECLARATION_NODES = [...TYPE_NODES, 'associatedtype_declaration', 'type_parameter'];
export const IMPORT_RULE_CHECK_RULES = { uncoveredFile: 'uncovered-file', refusedImport: 'refused-import' } as const;
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
export const MEMBER_DOT = '.';
// A capitalized identifier under one of these parents names a label, binding, enum case, macro, module, or build flag.
export const NON_USE_PARENTS: ReadonlySet<string> = new Set([
    'directive',
    'enum_entry',
    'identifier',
    'macro_invocation',
    'parameter',
    'pattern',
    'value_argument_label',
]);
export const OWN_FILES_ONLY = 'only its own files';
export const PYTHON_SOURCE_ROOTS = ['', 'src'] as const;
export const UNCOVERED_FILE_MESSAGE =
    'No [[import_rule]] covers this file. Add a path that matches it to an import rule, or record an [[ignore]] for structure/import-rules with its paths and a reason.';
export const USE_NODES = ['type_identifier', 'simple_identifier'];

// jscpd check
export const CLONE_RULE = 'clone';
export const JSCPD_ARGUMENTS = ['--reporters', 'json', '--silent'] as const;
export const JSCPD_CHECK = 'structure/jscpd';
export const JSCPD_CONFIG_FILE = 'jscpd.json';
export const JSCPD_IGNORED = ['**/*.md', '**/*.mdx'] as const;
export const JSCPD_IMPORT_PATTERNS = [
    String.raw`import\s[^;]*?from\s*['"][^'"]+['"]\s*;`,
    String.raw`(?:^|\n)[\t ]*(?:from[\t ]+(?:\\\r?\n[\t ]*)*[\w.]+[\t ]+(?:\\\r?\n[\t ]*)*)?import[\t ]+(?:\\\r?\n[\t ]*)*(?:\([^;)]*\)|(?:\\\r?\n|[^;\r\n])*)`,
] as const;
export const JSCPD_REPORT_FILE = 'jscpd-report.json';
export const JSCPD_TOOL = 'jscpd';
export const OUTPUT_FLAG = '--output';

// lone-files check
export const LONE_FILE_RULE = 'lone-file';

// long-files check
export const FILE_LINES_RULE = 'file-lines';

// parsed-sources check
export const SOURCE_QUERIES = {
    bash: `(function_definition) @function
(variable_assignment) @assignment`,
    python: '(function_definition) @function',
    swift: `[(function_declaration body: (function_body)) (init_declaration) (deinit_declaration) (computed_getter)
(computed_setter) (computed_property (statements)) (willset_clause) (didset_clause)] @function
(do_statement) @block`,
} as const;

// pass-through-folders check
export const PASS_THROUGH_FOLDER_RULE = 'pass-through-folder';

// shared-prefixes check
export const COMPANION_SUFFIX = /\.(?:test|spec|stories|story|module|styles?|mock|bench)$/u;
const MISE_HOOKS_PATH = '.mise/tasks/hook';
export const HOOK_FOLDERS = [GSPOT_PATHS.hooks, MISE_HOOKS_PATH, ...FOREIGN_HOOK_FOLDERS] as const;
export const INDEX_BASE_NAMES = new Set(['index', 'mod', '__init__']);
export const SHARED_PREFIX_RULE = 'shared-prefix';
export const SPEC_SUFFIX = /\.spec$/u;
export const TYPE_FILE_CASE = 'pascal';

// swift-modules check
export const NON_WORD_CHARACTERS = /\W/gu;

// trivial-functions check
export const BARE_NAME_NODES = new Set(['identifier', 'simple_identifier', 'attribute', 'navigation_expression']);
export const BASH_COMMAND_NODES: ReadonlySet<string> = new Set(['command', 'declaration_command']);
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
export const DECORATED_PYTHON_NODE = 'decorated_definition';
export const FORWARDING_NODES: ReadonlySet<string> = new Set(['future_import_statement', 'hash_bang_line']);
export const FUNCTION_LABEL = 'function';
// The syntax node of a name in a call, a reference, or a definition; a Bash function runs as a command word.
export const LANGUAGE_NAME_NODES: Readonly<Record<ParsedLanguage, string>> = {
    python: 'identifier',
    swift: 'simple_identifier',
    bash: 'word',
};
export const ONE_STATEMENT = '1 statement';
export const PYTHON_EXPORT_LIST = '__all__';
export const SCRIPT_COUNTED_DECLARATIONS: ReadonlySet<string> = new Set([
    'abstract_class_declaration',
    'class_declaration',
    'enum_declaration',
    'lexical_declaration',
    'variable_declaration',
]);
export const SCRIPT_GRAMMARS: ReadonlySet<string> = new Set(['javascript', 'typescript', 'tsx']);
export const SCRIPT_MODULE_NAME_PARENTS: ReadonlySet<string> = new Set([
    'export_specifier',
    'import_clause',
    'import_specifier',
    'namespace_import',
]);
// The declarations that name the code inside them: the caller of a call, or the definition of a name.
export const SCRIPT_NAMED_NODES: ReadonlySet<string> = new Set([
    'class_declaration',
    'function_declaration',
    'function_signature',
    'generator_function_declaration',
    'variable_declarator',
]);
export const SCRIPT_NAME_NODES = ['identifier', 'shorthand_property_identifier'];
export const SCRIPT_TYPE_DECLARATIONS: ReadonlySet<string> = new Set([
    'function_signature',
    'interface_declaration',
    'type_alias_declaration',
]);
export const SCRIPT_UNCOUNTED_STATEMENTS: ReadonlySet<string> = new Set(['empty_statement']);
export const SWIFT_ACCESSOR_NODES = new Set([
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
// A component file calls script functions, and no grammar parses it, so its text is searched for names.
export const TEMPLATE_EXTENSIONS: ReadonlySet<string> = new Set(['.astro', '.mdx']);
export const TEMPLATE_IMPORT_CLAUSE = /\bimport\s[^;'"]*\bfrom\s/gu;
export const TEMPLATE_NAME = /([\w$]+)(\s*\()?/gu;
export const TRIVIAL_FILE_MESSAGE =
    'This file only imports, re-exports, or renames code. Import from the module that defines it, and delete this file.';
export const TRIVIAL_FUNCTION_RULES = { trivialFunction: 'trivial-function', trivialFile: 'trivial-file' } as const;
export const TYPE_ALIAS_NODES = new Set(['type_alias_statement', 'typealias_declaration']);
export const TYPE_REFERENCE_NODES = new Set(['type', 'user_type', 'identifier', 'type_identifier']);
