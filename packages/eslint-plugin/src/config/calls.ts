export const NAMED_ARGUMENT_MINIMUM = 2;

export const COMPARATOR_ARITY = 2;

export const DIRECTIONAL_KEY = /\b(?:rtl|ltr|reverse|flip|swap|forward|backward)\b/iu;

export const CRYPTO_ROUND_NAME = /^(?:md[45]_?)?(?:ff|gg|hh|ii)$/iu;

export const CRYPTO_STATE_SIZE = 4;

export const BOXED_TYPE_NAMES: ReadonlyMap<string, string> = new Map([
    ['String', 'string'],
    ['Boolean', 'boolean'],
    ['Number', 'number'],
]);

export const EVENT_LISTENER_KEY = /^on[A-Z]/u;

export const SIDE_EFFECT_NODES: ReadonlySet<string> = new Set([
    'CallExpression',
    'NewExpression',
    'AssignmentExpression',
    'UpdateExpression',
    'YieldExpression',
    'AwaitExpression',
]);

export const EFFECT_CHILD_KEYS: Readonly<Record<string, readonly string[]>> = {
    SequenceExpression: ['expressions'],
    ConditionalExpression: ['consequent', 'alternate'],
    LogicalExpression: ['left', 'right'],
    BinaryExpression: ['left', 'right'],
    UnaryExpression: ['argument'],
    MemberExpression: ['object'],
    ArrayExpression: ['elements'],
    ObjectExpression: ['properties'],
    Property: ['value'],
};

export const ARRAY_CALLBACK_METHODS: ReadonlySet<string> = new Set([
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

export const ARRAY_TYPE_NAMES: ReadonlySet<string> = new Set([
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
