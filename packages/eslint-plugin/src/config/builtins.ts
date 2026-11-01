export const NEVER_TYPE = 'never';

export const SPLICE_METHOD = 'splice';

const TEST_SUITE_CALLS = ['describe', 'context', 'it', 'test'];

const SKIPPED_TEST_PREFIX = 'x';

const FOCUSED_TEST_PREFIX = 'f';

export const TEST_STRUCTURE_CALLS: ReadonlySet<string> = new Set([
    ...TEST_SUITE_CALLS.flatMap((name) => [name, `${SKIPPED_TEST_PREFIX}${name}`, `${FOCUSED_TEST_PREFIX}${name}`]),
    'suite',
    'specify',
    'before',
    'after',
    'beforeEach',
    'afterEach',
    'beforeAll',
    'afterAll',
]);

export const ARGUMENTS_NAME = 'arguments';

export const UNDEFINED_NAME = 'undefined';

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

export const MUTATING_ORDER_METHODS: ReadonlyMap<string, string> = new Map([
    ['reverse', 'toReversed'],
    ['sort', 'toSorted'],
]);

export const GETTER_DECLARATION =
    /^(?:@\S+\s+)*(?:(?:public|private|protected|static|override|abstract|declare)\s+)*get\s/u;

export const PURE_RECEIVER_SYMBOLS: ReadonlySet<string> = new Set(['Array', 'Date', 'Math', 'RegExp']);

export const EARLY_EXIT_METHODS: ReadonlySet<string> = new Set(['find', 'findIndex', 'findLast', 'findLastIndex']);

export const PURE_METHODS: Readonly<Record<string, ReadonlySet<string>>> = {
    array: new Set([
        'concat',
        'includes',
        'join',
        'slice',
        'indexOf',
        'lastIndexOf',
        'entries',
        'filter',
        'findIndex',
        'findLast',
        'findLastIndex',
        'keys',
        'map',
        'values',
        'find',
        'reduce',
        'reduceRight',
        'toString',
        'toLocaleString',
    ]),
    date: new Set([
        'getDate',
        'getDay',
        'getFullYear',
        'getHours',
        'getMilliseconds',
        'getMinutes',
        'getMonth',
        'getSeconds',
        'getTime',
        'getTimezoneOffset',
        'getUTCDate',
        'getUTCDay',
        'getUTCFullYear',
        'getUTCHours',
        'getUTCMilliseconds',
        'getUTCMinutes',
        'getUTCMonth',
        'getUTCSeconds',
        'getYear',
        'toDateString',
        'toISOString',
        'toJSON',
        'toGMTString',
        'toLocaleDateString',
        'toLocaleTimeString',
        'toTimeString',
        'toUTCString',
        'toString',
        'toLocaleString',
    ]),
    math: new Set([
        'abs',
        'acos',
        'acosh',
        'asin',
        'asinh',
        'atan',
        'atanh',
        'atan2',
        'cbrt',
        'ceil',
        'clz32',
        'cos',
        'cosh',
        'exp',
        'expm1',
        'floor',
        'fround',
        'hypot',
        'imul',
        'log',
        'log1p',
        'log10',
        'log2',
        'max',
        'min',
        'pow',
        'random',
        'round',
        'sign',
        'sin',
        'sinh',
        'sqrt',
        'tan',
        'tanh',
        'trunc',
    ]),
    number: new Set(['toExponential', 'toFixed', 'toPrecision', 'toLocaleString', 'toString']),
    regexp: new Set(['test', 'toString']),
    string: new Set([
        'charAt',
        'charCodeAt',
        'codePointAt',
        'concat',
        'includes',
        'endsWith',
        'indexOf',
        'lastIndexOf',
        'localeCompare',
        'match',
        'normalize',
        'padEnd',
        'padStart',
        'repeat',
        'replace',
        'search',
        'slice',
        'split',
        'startsWith',
        'substr',
        'substring',
        'toLocaleLowerCase',
        'toLocaleUpperCase',
        'toLowerCase',
        'toUpperCase',
        'trim',
        'toString',
        'valueOf',
        'anchor',
        'big',
        'blink',
        'bold',
        'fixed',
        'fontcolor',
        'fontsize',
        'italics',
        'link',
        'small',
        'strike',
        'sub',
        'sup',
    ]),
};

export const PROMISE_NAME = 'Promise';

export const SETTLE_METHOD = 'resolve';

export const KEY_WRITE_ARGUMENTS: ReadonlyMap<string, number> = new Map([
    ['add', 1],
    ['set', 2],
]);

export const REPLACE_METHOD = 'replace';

export const MUTABLE_TARGETS: ReadonlySet<string> = new Set(['Identifier', 'MemberExpression']);

export const CATCH_METHOD = 'catch';

export const CALL_NODES: ReadonlySet<string> = new Set(['AwaitExpression', 'CallExpression', 'NewExpression']);

export const HANDLING_PARENTS: ReadonlySet<string> = new Set(['AwaitExpression', 'YieldExpression']);

export const CHAINED_USES: ReadonlyMap<string, 'handled' | 'caught'> = new Map([
    ['then', 'handled'],
    ['catch', 'caught'],
]);

export const BOOLEAN_NAME = 'Boolean';

export const SETTLE_ACTIONS = ['resolve', 'reject'] as const;

export const UNDEFINED_TYPE = 'undefined';

export const LIBRARY_PATH = /[\\/]node_modules[\\/]/u;

export const ABSORBING_TYPES: ReadonlyMap<string, string> = new Map([
    ['TSAnyKeyword', 'any'],
    ['TSNeverKeyword', 'never'],
]);

export const EMPTY_TYPE_NAMES: ReadonlySet<string> = new Set(['null', 'undefined', 'void']);

export const LITERAL_UNION_MEMBERS: ReadonlySet<string> = new Set([
    'TSStringKeyword',
    'TSNumberKeyword',
    'TSTypeReference',
]);

export const INTERFACE_DECLARATION = /^(?:export\s+)?(?:declare\s+)?interface\s+[\w$]+\s*(?:(?:<[^{]*>)\s*)?\{/u;

export const LITERAL_UNION_SIZE = 2;
