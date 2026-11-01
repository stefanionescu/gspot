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
