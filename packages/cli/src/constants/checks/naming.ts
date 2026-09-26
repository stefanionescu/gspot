// The literal values checks/naming reads: names, patterns, limits, and tables.

export const RESERVED_USES: Record<string, string[]> = {
    directory: ['directories', 'packages'],
    'file stem': ['files', 'modules'],
    variable: ['variables', 'constants', 'parameters'],
    property: ['properties', 'attributes', 'enum_cases'],
    field: ['properties', 'attributes'],
    'identifier word': ['*'],
};
export const DIGIT = /\d/u;
export const TEST_GROUP = 'test group';
export const VERB_CATEGORIES = new Set(['functions', 'methods', 'variables']);
export const SEPARATORS = /[^A-Za-z0-9]+/u;
export const REACT_FILE = /\.[jt]sx$/u;
export const TEST_FILE = /(?:(?:^|\/)(?:tests?|__tests__)\/)|(?:\.(?:test|spec)\.[^./]+$)/u;
export const LOWER_WORD = /^[a-z]+$/u;
export const CAMEL_WORD = /^[a-z][A-Za-z]*$/u;
export const PASCAL_WORD = /^[A-Z][A-Za-z]*$/u;
export const UPPER_WORD = /^[A-Z]+$/u;
export const TIMESTAMP = /^\d+$/u;
export const POLICY_ASSET = 'packages/cli/configurations/policy/naming/policy.json';
/** The identifier categories a setting can narrow to; every other category borrows the limits of one of these. */
export const CATEGORY_PARENTS: Record<string, string> = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'directories',
};
/** The leading verb allowed only in framework callback positions. */
export const CALLBACK_VERB = 'handle';
/** The digits of a migration timestamp, YYYYMMDDHHMMSS. */
export const MIGRATION_TIMESTAMP_DIGITS = 14;
export const DECLARATION_SUFFIXES = ['.d.ts', '.d.mts', '.d.cts'];
export const MIGRATION_DIRECTORY = /^\d{14}_/u;
export const WRAPPERS: { open: string; close: string; category: string }[] = [
    { open: '[', close: ']', category: 'path_parameters' },
    { open: '(', close: ')', category: 'directories' },
    { open: '@', close: '', category: 'directories' },
    { open: '_', close: '', category: 'directories' },
];
export const SQL_LABELS: Record<string, string> = {
    schemas: 'schema',
    tables: 'table',
    columns: 'column',
    indexes: 'index',
    triggers: 'trigger',
    policies: 'policy',
    functions: 'function',
    parameters: 'parameter',
};
export const PYTHON_LABELS: Record<string, string> = {
    classes: 'class',
    exceptions: 'exception',
    functions: 'function',
    methods: 'method',
    parameters: 'parameter',
    variables: 'variable',
    constants: 'constant',
    attributes: 'attribute',
    type_aliases: 'type alias',
};
export const SWIFT_LABELS: Record<string, string> = {
    types: 'type',
    functions: 'function',
    methods: 'method',
    parameters: 'parameter',
    properties: 'property',
    constants: 'constant',
    variables: 'variable',
    enum_cases: 'enum case',
};
export const TYPESCRIPT_LABELS: Record<string, string> = {
    functions: 'function',
    methods: 'method',
    classes: 'class',
    types: 'type',
    properties: 'property',
    enum_cases: 'enum case',
    parameters: 'parameter',
    variables: 'variable',
};
export const PYTHON_PARAMETER_NODES = new Set([
    'identifier',
    'typed_parameter',
    'default_parameter',
    'typed_default_parameter',
]);
export const TYPESCRIPT_PARAMETER_NODES = ['required_parameter', 'optional_parameter'];
export const SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);
export const IMPLICIT_PARAMETERS = new Set(['self', 'cls']);
export const DUNDER = /^__\w+__$/u;
export const PYTHON_UPPER_SHAPE = /^_?[A-Z][A-Z\d_]*$/u;
export const TYPESCRIPT_UPPER_SHAPE = /^[A-Z][A-Z0-9_]*$/u;
export const EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;
export const TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'];
export const SWIFT_FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'];
export const TYPESCRIPT_FUNCTION_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
];
export const MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);
export const METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'];
export const NAMED_DECLARATIONS: [string[], string][] = [
    [TYPESCRIPT_FUNCTION_NODES, 'functions'],
    [METHOD_NODES, 'methods'],
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
export const SNAKE_SHAPE = /^[a-z][a-z0-9_]*$/u;
