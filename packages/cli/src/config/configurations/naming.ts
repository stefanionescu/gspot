// allowed-names check
export const UNUSED_RECORD_RULE = 'unused-record';

// identifier names
export const NAME_QUOTE = '`';

// identifiers check
// The SQL parser reads Postgres, so its syntax errors say nothing about a file in another dialect.
export const POSTGRES_PARSER_DIALECTS: ReadonlySet<string> = new Set(['postgres']);
export const SQL_SYNTAX_HELP =
    'Fix the syntax at the reported line. gspot reads this file as Postgres: for a folder in another dialect, run `gspot set sql.dialect <dialect> --scope <folder>`.';

// naming settings
// JavaScript files follow the naming table of TypeScript, so one set of naming.typescript settings covers both.
export const SHARED_NAMING_LANGUAGES: Readonly<Record<string, string>> = { javascript: 'typescript' };

// paths check
export const REST_SEGMENT = /^\.\.\./u;

// python names
export const CONSTANT_NAME = /^_?[A-Z][A-Z\d_]*$/u;
export const EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;
export const IMPLICIT_PARAMETERS = new Set(['self', 'cls']);
export const PYTHON_PARAMETER_NODES = new Set([
    'identifier',
    'typed_parameter',
    'default_parameter',
    'typed_default_parameter',
]);
export const SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);
export const TYPE_ALIAS_ANNOTATION = /^(?:\w+\.)?TypeAlias$/u;
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
export const TYPE_NAME =
    /^(?:[A-Z][a-z]\w*|int|str|float|bool|bytes|complex|object|list|dict|set|tuple|type|frozenset|bytearray)$/u;

// sql names
export const CREATE_KIND = /^\w+(?:\s+IF\s+NOT\s+EXISTS)?/iu;
export const CREATE_MODIFIER = /^(?:UNIQUE|CONSTRAINT|MATERIALIZED|TEMPORARY|TEMP|UNLOGGED)\s+/iu;
export const CREATE_PREFIX = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?/iu;
export const NAME_TOKEN = /"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*/gu;
export const DOTTED_NAME = new RegExp(String.raw`^\s*\.\s*(?:${NAME_TOKEN.source})`, 'u');
export const LEADING_NAME = new RegExp(`^(?:${NAME_TOKEN.source})`, 'u');
export const PARAMETER_DEPTH = new Map<string, number>([
    ['(', 1],
    ['[', 1],
    [')', -1],
    [']', -1],
]);
export const PARAMETER_PREFIX = /^\s*(?:(?:INOUT|IN|OUT|VARIADIC)\s+)?/iu;
export const TABLE_PARAMETERS = /^\s*RETURNS\s+TABLE\s*\(/iu;

// swift names
export const MEMBER_PARENTS = new Set(['class_body', 'protocol_body', 'enum_class_body']);
export const OBJC_ATTRIBUTE = 'objc';
// SWIFT.md reserves `handle...` for the UIKit target-action and notification handlers marked `@objc`.
export const OBJC_CALLBACK_PREFIX = /^handle(?=[A-Z])/u;
const SWIFT_FUNCTION_NODES = ['function_declaration', 'protocol_function_declaration'] as const;
export const SWIFT_CALLABLE_NODES = [...SWIFT_FUNCTION_NODES, 'init_declaration'] as const;

// typescript names
export const COMPONENT_FACTORY = /^(?:React\.)?(?:createContext|lazy|memo|forwardRef)$|^styled\b/u;
const TYPESCRIPT_FUNCTION_NODES = [
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
] as const;
export const DECLARATIONS = [
    [TYPESCRIPT_FUNCTION_NODES, 'functions'],
    [['method_definition', 'abstract_method_signature'], 'methods'],
    [['class_declaration', 'abstract_class_declaration'], 'classes'],
    [['interface_declaration', 'type_alias_declaration', 'enum_declaration'], 'types'],
    [['public_field_definition'], 'properties'],
    [['enum_assignment'], 'enum_cases'],
] as const;
const METHOD_NODES = ['method_definition', 'method_signature', 'abstract_method_signature'] as const;
export const PATTERN_FIELDS: Readonly<Record<string, string>> = {
    pair_pattern: 'value',
    object_assignment_pattern: 'left',
    assignment_pattern: 'left',
};
export const PATTERN_LISTS = new Set(['rest_pattern', 'object_pattern', 'array_pattern']);
export const TYPESCRIPT_CALLABLE_NODES = [...TYPESCRIPT_FUNCTION_NODES, ...METHOD_NODES, 'arrow_function'] as const;
export const TYPESCRIPT_NAME_NODES = new Set([
    'identifier',
    'property_identifier',
    'private_property_identifier',
    'type_identifier',
]);
export const TYPESCRIPT_PARAMETER_NODES: ReadonlySet<string> = new Set(['required_parameter', 'optional_parameter']);

// validation check
export const BANNED_WORD_FORMS: Readonly<Record<string, readonly string[]>> = {
    catalog: ['catalog', 'catalogue'],
    sync: ['sync', 'synchronize'],
    resolve: ['resolve', 'resolution'],
};
export const CAMEL_ACRONYM_WORD = /^\d*[a-z][A-Za-z\d]*$/u;
export const CAMEL_WORD = /^\d*[a-z][a-z\d]*(?:[A-Z][a-z\d]+)*[A-Z]?$/u;
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
export const DIGIT = /\d/u;
export const DIGITS_ONLY = /^\d+$/u;
export const LAST_EXTENSION = /\.[^.]*$/u;
export const LOWER_WORD = /^\d*[a-z][a-z\d]*$/u;
export const NAMING_RULES = {
    case: 'case',
    digits: 'digits',
    length: 'length',
    words: 'words',
    duplicateWords: 'duplicate-words',
    bannedWord: 'banned-word',
} as const;
export const PASCAL_ACRONYM_WORD = /^\d*[A-Z][A-Za-z\d]*$/u;
export const PASCAL_WORD = /^\d*(?=[A-Z])(?:[A-Z][a-z\d]+)*[A-Z]?$/u;
export const RUFF_CATEGORIES: ReadonlySet<string> = new Set([
    'classes',
    'exceptions',
    'functions',
    'methods',
    'parameters',
]);
export const SILENT_E = 'e';
export const SWIFTLINT_CATEGORIES: ReadonlySet<string> = new Set([
    'types',
    'classes',
    'type_aliases',
    'exceptions',
    'variables',
    'constants',
]);
export const TEST_WORD_LIST = 'tests';
export const TRAILING_Y = 'y';
export const UPPER_WORD = /^\d*[A-Z][A-Z\d]*$/u;
export const VOWEL_SUFFIX = /^[aeiou]/u;
export const WORD_FORM_CONSONANT = /[aeiou][bcdfghjklmnpqrstvwxyz]$/u;
export const WORD_FORM_SUFFIXES = ['s', 'es', 'ed', 'ing', 'ings'] as const;

// words
export const DIGIT_BOUNDARY = /(?<=\D)(?=\d)|(?<=\d)(?=\D)/u;
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
export const WORD_SEPARATORS = /[^A-Za-z0-9]+/u;
