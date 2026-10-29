export const EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;

export const SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);

export const PARAMETER_NODES = new Set([
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
