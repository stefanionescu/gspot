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

export const UNDEFINED_NAME = 'undefined';

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

export const REPLACE_METHOD = 'replace';

export const CATCH_METHOD = 'catch';

export const CALL_NODES: ReadonlySet<string> = new Set(['AwaitExpression', 'CallExpression', 'NewExpression']);

export const HANDLING_PARENTS: ReadonlySet<string> = new Set(['AwaitExpression', 'YieldExpression']);

export const CHAINED_USES: ReadonlyMap<string | null, 'handled' | 'caught'> = new Map([
    ['then', 'handled'],
    ['catch', 'caught'],
]);

export const SETTLE_ACTIONS = ['resolve', 'reject'] as const;
