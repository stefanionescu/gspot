import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

import { FUNCTION_NODES, TYPE_ASSERTION_NODES } from './plugin.ts';

// no-async-constructor rule
export const CONSTRUCTOR_BODY_DEPTH = 2;
export const SETTLE_METHOD = 'resolve';

// no-boolean-parameters rule
export const BOOLEAN_UNION_MEMBERS: ReadonlySet<string> = new Set([
    'TSBooleanKeyword',
    'TSNullKeyword',
    'TSUndefinedKeyword',
]);
export const DECLARATION_FILE = /\.d\.[cm]?ts$/u;
export const TYPED_VALUE_PARENTS: ReadonlySet<string> = new Set([
    'AssignmentExpression',
    'JSXExpressionContainer',
    'TSAsExpression',
    'TSSatisfiesExpression',
]);
export const VALUE_CONTAINERS: ReadonlySet<string> = new Set(['ArrayExpression', 'ObjectExpression', 'Property']);

// no-empty-return-value rule
export const EMPTY_RETURN_TYPES = new Set(['TSVoidKeyword', 'TSNeverKeyword', 'TSUndefinedKeyword']);
export const UNUSED_CALL_PARENTS = new Set([
    'ExpressionStatement',
    'ArrowFunctionExpression',
    'UnaryExpression',
    'AwaitExpression',
    'ReturnStatement',
    'ThrowStatement',
]);

// no-identical-functions rule
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

// no-ignored-return rule
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
export const PURE_RECEIVER_SYMBOLS: ReadonlySet<string> = new Set(['Array', 'Date', 'Math', 'RegExp']);
export const REPLACE_METHOD = 'replace';

// no-invariant-returns rule
export const BARE_RETURN_BRANCH = 'false,true';
export const BRANCH_KEYS: ReadonlyMap<string, readonly string[]> = new Map([
    ['IfStatement', ['consequent', 'alternate']],
    ['WhileStatement', ['body']],
    ['DoWhileStatement', ['body']],
    ['ForStatement', ['body']],
    ['ForInStatement', ['body']],
    ['ForOfStatement', ['body']],
]);
export const EFFECT_ONLY_BRANCH = 'true,false';
export const EFFECT_RETURN_BRANCH = 'true,true';
export const MINIMUM_RETURNS = 2;

// no-mixed-return-types rule
export const ANY_TYPE = 'any';
export const BOXED_STRING_NAME = 'String';
export const FUNCTION_TYPE_TEXT = /^[(<]/u;
export const RETURN_DOC_TAGS: ReadonlySet<string> = new Set(['return', 'returns']);
export const SANITATION_MEMBERS = 2;
export const TRUE_TYPE = 'true';
export const UNKNOWN_TYPE_NAMES: ReadonlySet<string> = new Set(['any', 'unknown', 'never']);

// no-nested-functions rule
export const DEFAULT_FUNCTION_NESTING = 5;
export const FUNCTION_NESTING_OPTIONS_SCHEMA = {
    type: 'object',
    properties: {
        threshold: { description: 'The deepest nesting of functions allowed.', type: 'integer', minimum: 1 },
    },
    additionalProperties: false,
} satisfies JSONSchema4;

// no-selector-parameter rule
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
export const EVENT_LISTENER_KEY = /^on[A-Z]/u;
export const SIDE_EFFECT_NODES: ReadonlySet<string> = new Set([
    'CallExpression',
    'NewExpression',
    'AssignmentExpression',
    'UpdateExpression',
    'YieldExpression',
    'AwaitExpression',
]);

// no-swapped-arguments rule
export const BOXED_TYPE_NAMES: ReadonlyMap<string, string> = new Map([
    ['String', 'string'],
    ['Boolean', 'boolean'],
    ['Number', 'number'],
]);
export const COMPARATOR_ARITY = 2;
export const CRYPTO_ROUND_NAME = /^(?:md[45]_?)?(?:ff|gg|hh|ii)$/iu;
export const CRYPTO_STATE_SIZE = 4;
export const DIRECTIONAL_KEY = /\b(?:rtl|ltr|reverse|flip|swap|forward|backward)\b/iu;
export const NAMED_ARGUMENT_MINIMUM = 2;

// no-trivial-functions rule
export const EXECUTABLE_DECLARATIONS = new Set(['VariableDeclaration', 'TSEnumDeclaration', 'ClassDeclaration']);
export const EXPORT_REFERENCE_PARENTS: ReadonlySet<string> = new Set(['ExportSpecifier', 'ExportDefaultDeclaration']);
export const FUNCTION_SELECTOR = `:matches(${[...FUNCTION_NODES].join(', ')})`;
export const INLINE_VALUE_PARENTS = new Set<string>([
    'ArrayExpression',
    'ReturnStatement',
    'JSXExpressionContainer',
    'ArrowFunctionExpression',
    'AssignmentPattern',
]);
export const NON_EXECUTABLE_STATEMENTS = new Set(['BlockStatement', 'EmptyStatement']);
export const ONE_STATEMENT = '1 statement';
export const TRANSPARENT_EXPRESSIONS = ['ConditionalExpression', 'LogicalExpression', ...TYPE_ASSERTION_NODES] as const;
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
export const TYPE_DECLARATIONS = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

// no-try-promise rule
export const CALL_NODES: ReadonlySet<string> = new Set(['AwaitExpression', 'CallExpression', 'NewExpression']);
export const CATCH_METHOD = 'catch';
export const CHAINED_USES: ReadonlyMap<string | null, 'handled' | 'caught'> = new Map([
    ['then', 'handled'],
    ['catch', 'caught'],
]);
export const HANDLING_PARENTS: ReadonlySet<string> = new Set(['AwaitExpression', 'YieldExpression']);

// prefer-promise-shorthand rule
export const SETTLE_ACTIONS = ['resolve', 'reject'] as const;

// promises
export const PROMISE_NAME = 'Promise';
