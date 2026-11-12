export const COLLECTION_TYPE_NAMES = new Set(['Array', 'Map', 'Set', 'WeakMap', 'WeakSet']);

export const READING_COLLECTION_METHODS: ReadonlySet<string> = new Set([
    'copyWithin',
    'pop',
    'reverse',
    'shift',
    'sort',
    'clear',
    'delete',
    'concat',
    'flat',
    'flatMap',
    'includes',
    'indexOf',
    'join',
    'lastIndexOf',
    'slice',
    'toSource',
    'toString',
    'toLocaleString',
    'get',
    'has',
    'entries',
    'every',
    'filter',
    'find',
    'findIndex',
    'forEach',
    'keys',
    'map',
    'reduce',
    'reduceRight',
    'some',
    'values',
]);

export const WRITING_COLLECTION_METHODS: ReadonlySet<string> = new Set([
    'copyWithin',
    'fill',
    'pop',
    'push',
    'reverse',
    'set',
    'shift',
    'sort',
    'splice',
    'unshift',
    'add',
    'clear',
    'delete',
]);

export const ELEMENT_WRITE_OPERATORS: ReadonlySet<string> = new Set(['=', '||=', '&&=', '??=']);

export const ARRAY_CALLBACK_METHODS: ReadonlySet<string | null> = new Set([
    'every',
    'filter',
    'find',
    'findLast',
    'findIndex',
    'findLastIndex',
    'map',
    'flatMap',
    'reduce',
    'reduceRight',
    'some',
    'sort',
    'toSorted',
]);

export const ARRAY_TYPE_NAMES: ReadonlySet<string | undefined> = new Set([
    'Array',
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',
]);

export const ARRAY_NAME = 'Array';

export const ARRAY_FROM_METHOD = 'from';

export const VOID_TYPE = 'void';

export const ARRAY_PROTOTYPE_NAMES: ReadonlySet<string> = new Set([
    'indexOf',
    'lastIndexOf',
    'forEach',
    'map',
    'filter',
    'every',
    'some',
]);

export const REDUCE_METHOD = 'reduce';

export const INDEX_OF_METHOD = 'indexOf';

export const KEY_WRITE_ARGUMENTS: ReadonlyMap<string, number> = new Map([
    ['add', 1],
    ['set', 2],
]);
