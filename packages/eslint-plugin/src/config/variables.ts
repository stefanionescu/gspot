import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

export const ARGUMENTS_NAME = 'arguments';

export const SHADOWING_EXCEPTIONS: ReadonlySet<string> = new Set([
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf',
    'escape',
    'unescape',
]);

export const BUILTIN_GLOBALS: ReadonlySet<string> = new Set([
    'AggregateError',
    'Array',
    'ArrayBuffer',
    'AsyncDisposableStack',
    'Atomics',
    'BigInt',
    'BigInt64Array',
    'BigUint64Array',
    'Boolean',
    'DataView',
    'Date',
    'decodeURI',
    'decodeURIComponent',
    'DisposableStack',
    'encodeURI',
    'encodeURIComponent',
    'Error',
    'eval',
    'EvalError',
    'FinalizationRegistry',
    'Float16Array',
    'Float32Array',
    'Float64Array',
    'Function',
    'globalThis',
    'Infinity',
    'Int16Array',
    'Int32Array',
    'Int8Array',
    'Intl',
    'isFinite',
    'isNaN',
    'Iterator',
    'JSON',
    'Map',
    'Math',
    'NaN',
    'Number',
    'Object',
    'parseFloat',
    'parseInt',
    'Promise',
    'Proxy',
    'RangeError',
    'ReferenceError',
    'Reflect',
    'RegExp',
    'Set',
    'SharedArrayBuffer',
    'String',
    'SuppressedError',
    'Symbol',
    'SyntaxError',
    'TypeError',
    'Uint16Array',
    'Uint32Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'undefined',
    'URIError',
    'WeakMap',
    'WeakRef',
    'WeakSet',
]);

export const IMMEDIATE_RETURN_DECLARATION =
    'VariableDeclaration[kind=/^(const|let|var)$/][declarations.length=1] > VariableDeclarator[id.type="Identifier"]:not([id.typeAnnotation])[init]';

export const EMPTY_LITERAL_DECLARATION =
    'VariableDeclaration > VariableDeclarator[id.type="Identifier"][init.type="ObjectExpression"][init.properties.length=0]';

export const UPSTREAM_RULE = 'no-magic-numbers';

export const MAGIC_NUMBER_OPTIONS_SCHEMA = {
    description: 'The options of @typescript-eslint/no-magic-numbers, passed through unchanged.',
    type: 'object',
    additionalProperties: true,
} satisfies JSONSchema4;

export const TRANSPOSED_UNARY_OPERATORS = new Set(['+', '-', '!']);

export const RESERVED_DECLARATION_NAMES = new Set([
    'implements',
    'interface',
    'package',
    'private',
    'protected',
    'public',
    'enum',
    'class',
    'const',
    'export',
    'extends',
    'import',
    'super',
    'let',
    'static',
    'yield',
    'await',
]);
