export const NAME_QUOTE = '`';

export const CATEGORY_LABELS = {
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
    folders: 'folder',
    modules: 'module',
    packages: 'package',
    path_parameters: 'path parameter',
} as const;

export const EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;

export const SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);

export const PYTHON_PARAMETER_NODES = new Set([
    'identifier',
    'typed_parameter',
    'default_parameter',
    'typed_default_parameter',
]);

export const IMPLICIT_PARAMETERS = new Set(['self', 'cls']);

export const CONSTANT_NAME = /^_?[A-Z][A-Z\d_]*$/u;

export const TYPE_NAME =
    /^(?:[A-Z][a-z]\w*|int|str|float|bool|bytes|complex|object|list|dict|set|tuple|type|frozenset|bytearray)$/u;

export const TYPE_FORMS: ReadonlySet<string> = new Set([
    'Literal',
    'Union',
    'Optional',
    'Annotated',
    'Callable',
    'tuple',
    'list',
    'dict',
    'set',
    'type',
]);

export const TYPE_ALIAS_ANNOTATION = /^(?:\w+\.)?TypeAlias$/u;

export const PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);

export const CREATE_PREFIX = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?/iu;

export const CREATE_MODIFIER = /^(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+/iu;

export const CREATE_KIND = /^\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;

export const NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;

export const QUALIFIED_NAME = new RegExp(
    String.raw`^(?:${NAME_TOKEN.source})(?:\s*\.\s*(?:${NAME_TOKEN.source}))*`,
    'u',
);

export const TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

export const PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;

export const TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'] as const;

const SWIFT_FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'] as const;

export const SWIFT_CALLABLE_NODES = [...SWIFT_FUNCTION_NODES, 'init_declaration'] as const;

export const MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);

export const PATTERN_FIELDS: Readonly<Record<string, string>> = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
};

export const NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
]);

export const PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);

export const TYPESCRIPT_PARAMETER_NODES: ReadonlySet<string> = new Set(['required_parameter', 'optional_parameter']);

export const COMPONENT_FACTORY = /^(?:React\.)?(?:createContext|lazy|memo|forwardRef)$|^styled\b/u;

const TYPESCRIPT_FUNCTION_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
] as const;

const METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'] as const;

export const DECLARATIONS = [
    [TYPESCRIPT_FUNCTION_NODES, 'functions'],
    [METHOD_NODES, 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition', 'property_signature'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
] as const;

export const TYPESCRIPT_CALLABLE_NODES = [...TYPESCRIPT_FUNCTION_NODES, ...METHOD_NODES, 'arrow_function'] as const;
