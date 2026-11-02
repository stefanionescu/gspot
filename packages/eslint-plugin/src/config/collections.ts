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

export const NESTED_MEMBER_DEPTH = 2;

export const STRUCTURED_CLONE_NAME = 'structuredClone';

export const CLONE_ADVICE: ReadonlyMap<string | undefined, string> = new Map([
    ['lodash.clone', 'structuredClone() or _.cloneDeep()'],
    ['lodash-es.clone', 'structuredClone() or _.cloneDeep()'],
    ['underscore.clone', 'structuredClone()'],
]);

export const DEEP_CLONE_NAMES: ReadonlySet<string | undefined> = new Set(['lodash.cloneDeep', 'lodash-es.cloneDeep']);

export const SHALLOW_CLONE_NAMES: ReadonlySet<string | undefined> = new Set([
    'lodash.clone',
    'lodash-es.clone',
    'underscore.clone',
]);
