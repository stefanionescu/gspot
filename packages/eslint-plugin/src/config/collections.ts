export const COLLECTION_SIZE_MEMBERS = new Set(['length', 'size']);

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
