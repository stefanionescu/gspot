import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

import { FUNCTION_NODES, TYPE_ASSERTION_NODES } from './plugin.ts';

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

export const FUNCTION_TYPE_TEXT = /^[(<]/u;

export const RETURN_DOC_TAGS: ReadonlySet<string> = new Set(['return', 'returns']);

export const UNKNOWN_TYPE_NAMES: ReadonlySet<string> = new Set(['any', 'unknown', 'never']);

export const ANY_TYPE = 'any';

export const TRUE_TYPE = 'true';

export const BOXED_STRING_NAME = 'String';

export const SANITATION_MEMBERS = 2;

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

export const REPLACE_METHOD = 'replace';

export const PROMISE_NAME = 'Promise';

export const SETTLE_METHOD = 'resolve';

export const CATCH_METHOD = 'catch';

export const CALL_NODES: ReadonlySet<string> = new Set(['AwaitExpression', 'CallExpression', 'NewExpression']);

export const HANDLING_PARENTS: ReadonlySet<string> = new Set(['AwaitExpression', 'YieldExpression']);

export const CHAINED_USES: ReadonlyMap<string | null, 'handled' | 'caught'> = new Map([
    ['then', 'handled'],
    ['catch', 'caught'],
]);

export const SETTLE_ACTIONS = ['resolve', 'reject'] as const;

export const TRIVIAL_FUNCTION_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        trivialFunctionStatements: {
            description: 'The rule reports each function with this many statements or fewer.',
            type: 'integer',
            minimum: 1,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const TRIVIAL_FUNCTION_STATEMENTS = 2;

export const INLINE_VALUE_PARENTS = new Set<string>([
    'ArrayExpression',
    'ReturnStatement',
    'JSXExpressionContainer',
    'ArrowFunctionExpression',
    'AssignmentPattern',
]);

export const FUNCTION_SELECTOR = `:matches(${[...FUNCTION_NODES].join(', ')})`;

export const TYPE_DECLARATIONS = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);

export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);

export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;

export const ONE_STATEMENT = '1 statement';

export const EMPTY_RETURN_TYPES = new Set(['TSVoidKeyword', 'TSNeverKeyword', 'TSUndefinedKeyword']);

export const UNUSED_CALL_PARENTS = new Set([
    'ExpressionStatement',
    'ArrowFunctionExpression',
    'UnaryExpression',
    'AwaitExpression',
    'ReturnStatement',
    'ThrowStatement',
]);

export const BRANCH_KEYS: ReadonlyMap<string, readonly string[]> = new Map([
    ['IfStatement', ['consequent', 'alternate']],
    ['WhileStatement', ['body']],
    ['DoWhileStatement', ['body']],
    ['ForStatement', ['body']],
    ['ForInStatement', ['body']],
    ['ForOfStatement', ['body']],
]);

export const MINIMUM_RETURNS = 2;

export const DEFAULT_FUNCTION_NESTING = 5;

export const FUNCTION_NESTING_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        threshold: { description: 'The deepest nesting of functions allowed.', type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const CONSTRUCTOR_BODY_DEPTH = 2;

export const EFFECT_ONLY_BRANCH = 'true,false';

export const EFFECT_RETURN_BRANCH = 'true,true';

export const BARE_RETURN_BRANCH = 'false,true';

export const DEFAULT_IDENTICAL_LINES = 3;

export const IDENTICAL_FUNCTIONS_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        minLines: {
            description: 'The fewest lines a function body spans before a copy of it is reported.',
            type: 'integer',
            minimum: 1,
        },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

export const EXPORT_REFERENCE_PARENTS: ReadonlySet<string> = new Set(['ExportSpecifier', 'ExportDefaultDeclaration']);
