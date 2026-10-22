export const PYTHON_EXCEPTION_BASE = /(?:Error|Exception|Warning)\b/u;

export const PYTHON_SPLAT_NODES = new Set(['list_splat_pattern', 'dictionary_splat_pattern']);

export const PYTHON_PARAMETER_NODES = new Set([
    'identifier',
    'typed_parameter',
    'default_parameter',
    'typed_default_parameter',
]);

export const PYTHON_IMPLICIT_PARAMETERS = new Set(['self', 'cls']);

export const PYTHON_CONSTANT = /^_?[A-Z][A-Z\d_]*$/u;

export const PYTHON_TYPE_NAME =
    /^(?:[A-Z][a-z]\w*|int|str|float|bool|bytes|complex|object|list|dict|set|tuple|type|frozenset|bytearray)$/u;

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

export const PYTHON_TYPE_ALIAS_ANNOTATION = /^(?:\w+\.)?TypeAlias$/u;
