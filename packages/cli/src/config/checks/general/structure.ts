/** Native declarations and reads used by the two source convention checks. */
export const CONVENTION_QUERIES = {
    bash: `(function_definition) @function
(command) @import
(variable_assignment) @assignment
[(simple_expansion (variable_name) @read) (expansion (variable_name) @read)]`,
    python: `(function_definition) @function
[(import_statement) (import_from_statement) (future_import_statement)] @import
[(attribute) (call) (identifier)] @read
(attribute object: (identifier) attribute: (identifier) @environment_name
(#eq? @environment_name "environ")) @environment
(call function: (attribute object: (identifier) attribute: (identifier) @getter_name
(#eq? @getter_name "getenv")) @environment)
[(assignment) (for_statement) (function_definition) (class_definition) (parameters)] @binding`,
    swift: `[(function_declaration body: (function_body)) (init_declaration) (deinit_declaration) (computed_getter)
(computed_setter) (computed_property (statements)) (willset_clause) (didset_clause)] @function
(import_declaration) @import
(navigation_expression) @read`,
} as const;

/** These Python os members read the process environment. */
export const OS_ENVIRONMENT_MEMBERS = { environ: 'environ', getenv: 'getenv' } as const;

export const INDEX_STEMS = new Set(['index', 'mod', '__init__']);

/** Comment styles for the languages whose code lines gspot counts. */
export const COMMENT_MARKERS = { bash: '#', python: '#', sql: '--' } as const;

// Counting executable statements in Python, Swift, and Bash syntax trees, and telling a trivial file from a real one.

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

export const BARE_NAME_NODES = new Set(['identifier', 'simple_identifier', 'attribute', 'navigation_expression']);

export const TYPE_REFERENCE_NODES = new Set(['type', 'user_type', 'identifier', 'type_identifier']);

export const SWIFT_FUNCTION_LABELS = {
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

export const PYTHON_IMPORT_NODES = new Set(['import_statement', 'import_from_statement', 'future_import_statement']);

export const SWIFT_ENV_READ = 'ProcessInfo.processInfo.environment';

export const LANGUAGE_BY_EXTENSION = { '.py': 'python', '.swift': 'swift' } as const;
export const PYTHON_SCOPE_NODES = ['function_definition', 'class_definition', 'lambda'] as const;
export const OS_MODULE = 'os';
export const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/u;
export const SPEC_SUFFIX = /\.spec$/u;

export const BASH_COMMAND_NODES = ['command', 'declaration_command'] as const;
export const BASH_SOURCE_COMMANDS = ['source', '.'] as const;
export const SWIFT_ACCESSOR_OWNERS = ['property_declaration', 'subscript_declaration'] as const;
