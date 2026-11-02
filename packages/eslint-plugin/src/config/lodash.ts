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
