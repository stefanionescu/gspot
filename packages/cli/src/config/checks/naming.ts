const SWIFT_FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'] as const;

const TYPESCRIPT_FUNCTION_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
] as const;

const TYPESCRIPT_METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'] as const;

export const NAMING_DEFAULTS_FILE = 'configurations/general/naming/defaults.json';

/** Complete PostgreSQL name tokens, including doubled quotes inside quoted names. */
export const SQL_NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;

/** The full qualified name of a relation starts at its RangeVar location. */
export const SQL_QUALIFIED_NAME = new RegExp(
    String.raw`^(?:${SQL_NAME_TOKEN.source})(?:\s*\.\s*(?:${SQL_NAME_TOKEN.source}))*`,
    'u',
);

/** Function parameters begin after an optional PostgreSQL parameter mode. */
export const SQL_PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;

/** Return-table declarations add output parameters after the input list. */
export const SQL_TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

export const SQL_PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);

export const DIGIT = /\d/u;

/** The identifier categories a setting can narrow to; every other category borrows the limits of one of these. */
export const CATEGORY_PARENTS = {
    classes: 'types',
    type_aliases: 'types',
    exceptions: 'types',
    methods: 'functions',
    constants: 'variables',
    attributes: 'properties',
    enum_cases: 'properties',
    modules: 'files',
    packages: 'folders',
} as const;

export const SEPARATORS = /[^A-Za-z0-9]+/u;

export const LOWER_WORD = /^[a-z]+$/u;

export const CAMEL_WORD = /^[a-z][A-Za-z]*$/u;

export const PASCAL_WORD = /^[A-Z][A-Za-z]*$/u;

export const UPPER_WORD = /^[A-Z]+$/u;

/** The digits of a migration timestamp, YYYYMMDDHHMMSS. */
export const MIGRATION_DIGITS = 14;

/** Technical words whose digits form part of their established spelling. */
export const NUMERIC_WORDS = new Set([
    'base64',
    'utf8',
    'utf16',
    'sha1',
    'sha256',
    'sha512',
    'md5',
    'oauth2',
    'http2',
    'http3',
    'ipv4',
    'ipv6',
    's3',
    'k8s',
    'e2e',
    'i18n',
    'l10n',
    'a11y',
    'int8',
    'int16',
    'int32',
    'int64',
    'uint8',
    'uint16',
    'uint32',
    'uint64',
    'float32',
    'float64',
]);

export const NAMED_CATEGORIES = [
    'schemas',
    'tables',
    'columns',
    'indexes',
    'triggers',
    'policies',
    'functions',
    'parameters',
    'classes',
    'exceptions',
    'methods',
    'variables',
    'constants',
    'attributes',
    'type_aliases',
    'types',
    'properties',
    'enum_cases',
    'files',
    'folders',
    'modules',
    'packages',
    'path_parameters',
] as const;

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

export const PYTHON_PARAMETER_NODES = new Set([
    'identifier',
    'typed_parameter',
    'default_parameter',
    'typed_default_parameter',
]);

export const PYTHON_SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);

export const PYTHON_IMPLICIT_PARAMETERS = new Set(['self', 'cls']);

export const PYTHON_CONSTANT = /^_?[A-Z][A-Z\d_]*$/u;

export const PYTHON_EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;

export const PYTHON_TYPE_ALIAS_ANNOTATION = /^(?:\w+\.)?TypeAlias$/u;

export const PYTHON_TYPE_FORMS: ReadonlySet<string> = new Set([
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

export const PYTHON_TYPE_NAME =
    /^(?:[A-Z][a-z]\w*|int|str|float|bool|bytes|complex|object|list|dict|set|tuple|type|frozenset|bytearray)$/u;

export const SWIFT_TYPE_NODES = ['class_declaration', 'protocol_declaration', 'typealias_declaration'] as const;

export const SWIFT_MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);

export const TYPESCRIPT_PARAMETER_NODES: ReadonlySet<string> = new Set(['required_parameter', 'optional_parameter']);

export const TYPESCRIPT_DECLARATIONS = [
    [TYPESCRIPT_FUNCTION_NODES, 'functions'],
    [TYPESCRIPT_METHOD_NODES, 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition', 'property_signature'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
] as const;

// A shorthand pattern such as const { handleSubmit } = useForm() takes the name that the destructured value declares.
export const TYPESCRIPT_NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
]);

export const COMPONENT_FACTORY = /^(?:React\.)?(?:createContext|lazy|memo|forwardRef)$|^styled\b/u;

export const TYPESCRIPT_PATTERN_FIELDS = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
} as const;

export const TYPESCRIPT_PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);

/** The names that case validation accepts, in their display order. */
export const CASE_NAMES = [
    'camel',
    'pascal',
    'pascal-extension',
    'kebab',
    'snake',
    'upper-snake',
    'timestamp-snake',
] as const;

export const REST_SEGMENT = /^\.\.\./u;

export const DIGIT_RUNS = /\d+/gu;

export const LAST_EXTENSION = /\.[^.]*$/u;

export const TEST_TERM_GROUP = 'tests';

export const DIGIT_BOUNDARY = /(?<=\D)(?=\d)|(?<=\d)(?=\D)/u;

export const SWIFTLINT_PARENTS: ReadonlySet<string> = new Set(['types', 'variables']);

export const RUFF_CATEGORIES: ReadonlySet<string> = new Set([
    'classes',
    'exceptions',
    'functions',
    'methods',
    'parameters',
]);

export const SWIFT_NAME_QUOTE = '`';

export const SWIFT_CALLABLE_NODES = [...SWIFT_FUNCTION_NODES, 'init_declaration'] as const;

export const TYPESCRIPT_CALLABLE_NODES = [
    ...TYPESCRIPT_FUNCTION_NODES,
    ...TYPESCRIPT_METHOD_NODES,
    'arrow_function',
] as const;

export const WORD_FORM_SUFFIXES = ['s', 'es', 'ed', 'ing', 'ings', 'er', 'ers'] as const;

export const WORD_FORM_CONSONANT = /[aeiou][bcdfghjklmnpqrstvwxyz]$/u;

export const BANNED_WORD_FORMS: Readonly<Record<string, readonly string[]>> = {
    catalog: ['catalog', 'catalogue'],
    sync: ['sync', 'synchronize'],
    resolve: ['resolve', 'resolution'],
};

export const SQL_CREATE_PREFIX = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?/iu;

export const SQL_CREATE_MODIFIER = /^(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+/iu;

export const SQL_CREATE_KIND = /^\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;
