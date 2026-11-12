export const LIBRARY_NAMES = new Map([
    ['lodash', 'lodash'],
    ['lodash-es', 'lodash-es'],
    ['underscore', 'underscore.js'],
]);

export const NATIVE_REPLACEMENTS = new Map([
    [
        'assign',
        { alternative: 'Object.assign()', year: 2015, reason: 'the library treats a nullish target differently' },
    ],
    [
        'concat',
        { alternative: 'Array.prototype.concat()', year: 5, reason: 'the library treats nullish values differently' },
    ],
    [
        'contains',
        {
            alternative: 'Array.prototype.includes()',
            year: 2016,
            reason: 'the library also accepts strings, objects, and nullish values',
        },
    ],
    [
        'drop',
        {
            alternative: 'Array.prototype.slice()',
            year: 5,
            reason: 'the library treats nullish values differently',
            example: '`array.slice(n)`',
        },
    ],
    [
        'dropRight',
        {
            alternative: 'Array.prototype.slice()',
            year: 5,
            reason: 'the library treats nullish values differently',
            example: '`n === 0 ? array.slice() : array.slice(0, -n)`',
        },
    ],
    [
        'entries',
        { alternative: 'Object.entries()', year: 2017, reason: 'the library treats nullish values differently' },
    ],
    [
        'every',
        {
            alternative: 'Array.prototype.every()',
            year: 5,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'extendOwn',
        { alternative: 'Object.assign()', year: 2015, reason: 'the library treats nullish values differently' },
    ],
    [
        'fill',
        { alternative: 'Array.prototype.fill()', year: 2015, reason: 'the library treats nullish values differently' },
    ],
    [
        'filter',
        {
            alternative: 'Array.prototype.filter()',
            year: 5,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'find',
        {
            alternative: 'Array.prototype.find()',
            year: 2015,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'findIndex',
        {
            alternative: 'Array.prototype.findIndex()',
            year: 2015,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'flatten',
        { alternative: 'Array.prototype.flat()', year: 2019, reason: 'the library treats nullish values differently' },
    ],
    [
        'includes',
        {
            alternative: 'Array.prototype.includes()',
            year: 2016,
            reason: 'the library also accepts strings, objects, and nullish values',
        },
    ],
    [
        'indexOf',
        { alternative: 'Array.prototype.indexOf()', year: 5, reason: 'the library treats nullish values differently' },
    ],
    ['isArray', { alternative: 'Array.isArray()', year: 5 }],
    ['isInteger', { alternative: 'Number.isInteger()', year: 2015 }],
    [
        'join',
        { alternative: 'Array.prototype.join()', year: 5, reason: 'the library treats nullish values differently' },
    ],
    ['keys', { alternative: 'Object.keys()', year: 5, reason: 'the library treats nullish values differently' }],
    [
        'lastIndexOf',
        {
            alternative: 'Array.prototype.lastIndexOf()',
            year: 5,
            reason: 'the library treats nullish values differently',
        },
    ],
    [
        'map',
        {
            alternative: 'Array.prototype.map()',
            year: 5,
            reason: 'the library also accepts objects and nullish values',
        },
    ],
    ['pairs', { alternative: 'Object.entries()', year: 2017, reason: 'the library treats nullish values differently' }],
    [
        'reduce',
        {
            alternative: 'Array.prototype.reduce()',
            year: 5,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'reduceRight',
        {
            alternative: 'Array.prototype.reduceRight()',
            year: 5,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'reverse',
        { alternative: 'Array.prototype.reverse()', year: 5, reason: 'the library treats nullish values differently' },
    ],
    [
        'slice',
        { alternative: 'Array.prototype.slice()', year: 5, reason: 'the library treats nullish values differently' },
    ],
    [
        'some',
        {
            alternative: 'Array.prototype.some()',
            year: 5,
            reason: 'the library also accepts objects, nullish values, and shorthand predicates',
        },
    ],
    [
        'takeRight',
        {
            alternative: 'Array.prototype.slice()',
            year: 5,
            reason: 'the library treats nullish values differently',
            example: '`n === 0 ? [] : array.slice(-n)`',
        },
    ],
    [
        'toPairs',
        { alternative: 'Object.entries()', year: 2017, reason: 'the library treats nullish values differently' },
    ],
    [
        'uniq',
        {
            alternative: 'Set',
            year: 2015,
            reason: 'the library treats nullish values differently',
            example: '`[...new Set(values)]`',
        },
    ],
    ['values', { alternative: 'Object.values()', year: 2017, reason: 'the library treats nullish values differently' }],
]);

export const STRING_INCLUDES = {
    alternative: 'String.prototype.includes()',
    year: 2016,
    reason: 'the library also accepts arrays, objects, and nullish values',
};

export const SEARCH_METHODS = new Set(['contains', 'includes']);

export const CALLBACK_METHODS = new Set([
    'every',
    'filter',
    'find',
    'findIndex',
    'map',
    'reduce',
    'reduceRight',
    'some',
]);

export const SHORTHAND_ITERATEES = new Set<string>([
    'ArrayExpression',
    'Literal',
    'ObjectExpression',
    'TemplateLiteral',
]);

export const PATTERN_TEXT = /^(?:\/|(?:new\s+)?RegExp\()/u;

export const UTILITY_LIBRARIES = new Map([
    ['lodash', { minimum: [4, 0, 0], example: 'lodash/map' }],
    ['lodash-es', { minimum: [4, 0, 0], example: undefined }],
    ['rxjs', { minimum: [7, 2, 0], example: undefined }],
    ['rambda', { minimum: [0, 8, 8], example: undefined }],
    ['validator', { minimum: [12, 1, 0], example: 'validator/es/lib/isEmail' }],
]);

export const MEMOIZE_FUNCTIONS = new Set(['lodash.memoize', 'lodash-es.memoize', 'underscore.memoize']);

export const JQUERY_GLOBALS = new Set(['jQuery', '$']);

export const JQUERY_ORIGINS = new Set(
    ['jquery', 'jquery.slim', 'jquery.dist.jquery.slim', 'jquery.dist.jquery.slim.js'].flatMap((module) => [
        module,
        `${module}.$`,
        `${module}.jQuery`,
    ]),
);

export const JQUERY_METHODS: ReadonlyMap<string | null, { alternative: string; isDeprecated: boolean }> = new Map([
    ['isArray', { alternative: 'Array.isArray()', isDeprecated: true }],
    ['parseJSON', { alternative: 'JSON.parse()', isDeprecated: true }],
    ['now', { alternative: 'Date.now()', isDeprecated: true }],
    ['trim', { alternative: 'String.prototype.trim()', isDeprecated: true }],
    ['inArray', { alternative: 'Array.prototype.indexOf()', isDeprecated: false }],
]);

export const AXIOS_DEPRECATIONS = new Map([
    ['axios.all', { symbol: 'axios.all()', alternative: 'Promise.all()' }],
    ['axios.spread', { symbol: 'axios.spread()', alternative: 'array destructuring' }],
]);

export const AXIOS_CANCEL_TOKEN = 'axios.CancelToken';

export const AXIOS_CONFIG_POSITIONS = new Map([
    ['axios', [0, 1]],
    ['axios.request', [0]],
    ['axios.get', [1]],
    ['axios.delete', [1]],
    ['axios.head', [1]],
    ['axios.options', [1]],
    ['axios.post', [2]],
    ['axios.put', [2]],
    ['axios.patch', [2]],
]);

export const NESTED_MEMBER_DEPTH = 2;

export const STRUCTURED_CLONE_NAME = 'structuredClone';

export const MUTATING_CALL =
    'CallExpression[callee.type="MemberExpression"][callee.property.name=/^(?:add|clear|copyWithin|delete|fill|pop|push|reverse|set|shift|sort|splice|unshift)$/]';

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
