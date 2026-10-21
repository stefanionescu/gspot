/** Function and assignment captures used by source checks. */
export const SOURCE_QUERIES = {
    bash: `(function_definition) @function
(variable_assignment) @assignment`,
    python: '(function_definition) @function',
    swift: `[(function_declaration body: (function_body)) (init_declaration) (deinit_declaration) (computed_getter)
(computed_setter) (computed_property (statements)) (willset_clause) (didset_clause)] @function`,
} as const;

export const INDEX_STEMS = new Set(['index', 'mod', '__init__']);

/** Comment styles for the languages whose code lines gspot counts. */
export const COMMENT_MARKERS = { bash: '#', python: '#', sql: '--' } as const;

// Syntax tree nodes that count as statements in Python, Swift, and Bash, to tell a trivial file from a real one.

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

export const TYPE_ALIAS_NODES = new Set(['type_alias_statement', 'typealias_declaration']);

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

export const PYTHON_INTERFACE_DECORATORS: ReadonlySet<string> = new Set([
    'overload',
    'override',
    'property',
    'abstractmethod',
    'abstractproperty',
    'abstractclassmethod',
    'abstractstaticmethod',
]);

export const PYTHON_ACCESSOR_DECORATOR = /\.(?:setter|getter|deleter)$/u;

export const PYTHON_INTERFACE_BASES: ReadonlySet<string> = new Set(['Protocol', 'ABC']);

export const PYTHON_ABSTRACT_METACLASS = 'ABCMeta';

export const BARE_NAME_NODES = new Set(['identifier', 'simple_identifier', 'attribute', 'navigation_expression']);

export const TYPE_REFERENCE_NODES = new Set(['type', 'user_type', 'identifier', 'type_identifier']);

export const SWIFT_FUNCTION_LABELS: Readonly<Record<string, string>> = {
    init_declaration: 'init',
    deinit_declaration: 'deinit',
    lambda_literal: 'closure',
    computed_getter: 'getter',
    computed_setter: 'setter',
    computed_property: 'getter',
    willset_clause: 'willSet observer',
    didset_clause: 'didSet observer',
} as const;

export const SWIFT_ACCESSOR_NODES = new Set([
    'computed_getter',
    'computed_setter',
    'computed_property',
    'willset_clause',
    'didset_clause',
]);

export const LANGUAGE_BY_EXTENSION = { '.py': 'python', '.swift': 'swift' } as const;

export const SPEC_SUFFIX = /\.spec$/u;

export const COMPANION_SUFFIX = /\.(?:test|spec|stories|story|module|styles?|mock|bench)$/u;

export const BASH_COMMAND_NODES: ReadonlySet<string> = new Set(['command', 'declaration_command']);

export const BASH_SOURCE_COMMANDS: ReadonlySet<string> = new Set(['source', '.']);

export const SWIFT_ACCESSOR_OWNERS: ReadonlySet<string> = new Set(['property_declaration', 'subscript_declaration']);

export const EXPORTED_FUNCTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs'] as const;

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

export const CONFIG_FILE_PATTERNS = ['**/*.config.*', '**/.*rc.*', '**/Package.swift', '**/setup.py'] as const;

export const PYTHON_EXTENSIONS = ['.py', '.pyi'] as const;

export const PYTHON_MODULE_SUFFIXES = ['.py', '.pyi', '/__init__.py', '/__init__.pyi'] as const;

export const PYTHON_SOURCE_ROOTS = ['', 'src'] as const;

export const PYTHON_IMPORT_STATEMENT = 'import_statement';

export const PYTHON_FROM_STATEMENT = 'import_from_statement';

export const RELATIVE_IMPORT = 'relative_import';

/** The folders where SwiftPM looks for a target without a path, in its order, by target kind. */
export const SWIFTPM_TARGET_FOLDERS: Readonly<Record<string, readonly string[]>> = {
    target: ['Sources', 'Source', 'src', 'srcs'],
    executableTarget: ['Sources', 'Source', 'src', 'srcs'],
    macro: ['Sources', 'Source', 'src', 'srcs'],
    testTarget: ['Tests', 'Sources', 'Source', 'src', 'srcs'],
    plugin: ['Plugins'],
};

/** Characters that Xcode replaces with an underscore in the module name of a target. */
export const SWIFT_MODULE_NAME_CHARACTERS = /\W/gu;

export const IMPORT_RULES_SKIP = 'Add [[import_rule]] records to check imports.';

export const UNCOVERED_FILE_MESSAGE =
    'No [[import_rule]] covers this file. Add a path that matches it to an import rule, or record an [[ignore]] for structure/import-rules with its paths and a reason.';
