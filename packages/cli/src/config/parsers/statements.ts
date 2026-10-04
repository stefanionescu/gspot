// Counting executable statements in Python, Swift, and Bash syntax trees, and telling a trivial file from a real one.

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
