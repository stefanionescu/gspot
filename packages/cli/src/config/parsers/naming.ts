export const CATEGORY_LABELS: Record<string, string> = {
    schemas: 'schema',
    tables: 'table',
    columns: 'column',
    indexes: 'index',
    triggers: 'trigger',
    policies: 'policy',
    functions: 'function',
    parameters: 'parameter',
    classes: 'class',
    exceptions: 'exception',
    methods: 'method',
    variables: 'variable',
    constants: 'constant',
    attributes: 'attribute',
    type_aliases: 'type alias',
    types: 'type',
    properties: 'property',
    enum_cases: 'enum case',
    files: 'file',
    directories: 'directory',
};

export const PYTHON_PARAMETER_NODES = new Set([
    'identifier',
    'typed_parameter',
    'default_parameter',
    'typed_default_parameter',
]);

export const SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);

export const IMPLICIT_PARAMETERS = new Set(['self', 'cls']);

export const DUNDER = /^__\w+__$/u;

export const PYTHON_CONSTANT = /^_?[A-Z][A-Z\d_]*$/u;

export const EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;

export const SWIFT_TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'];

export const SWIFT_FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'];

export const MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);

export const TYPESCRIPT_PARAMETER_NODES = ['required_parameter', 'optional_parameter'];

export const TYPESCRIPT_FUNCTION_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
];

export const TYPESCRIPT_METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'];

export const NAMED_DECLARATIONS: [string[], string][] = [
    [TYPESCRIPT_FUNCTION_NODES, 'functions'],
    [TYPESCRIPT_METHOD_NODES, 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition', 'property_signature'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
];

export const NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
    'shorthand_property_identifier_pattern',
]);

export const PATTERN_FIELDS: Record<string, string> = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
};

export const PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);

export const SEPARATORS = /[^A-Za-z0-9]+/u;

export const LOWER_WORD = /^[a-z]+$/u;

export const CAMEL_WORD = /^[a-z][A-Za-z]*$/u;

export const PASCAL_WORD = /^[A-Z][A-Za-z]*$/u;

export const UPPER_WORD = /^[A-Z]+$/u;

export const TIMESTAMP = /^\d+$/u;

/** The digits of a migration timestamp, YYYYMMDDHHMMSS. */
export const MIGRATION_DIGITS = 14;
