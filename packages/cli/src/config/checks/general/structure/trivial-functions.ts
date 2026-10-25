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
