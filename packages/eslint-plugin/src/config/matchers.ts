export const MATCHER_FAMILIES = new Map([
    ['jest-like', 'jest'],
    ['playwright', 'jest'],
    ['jasmine', 'jest'],
    ['chai-assert', 'chai-assert'],
    ['cypress', 'cypress'],
]);

export const OPERAND_KINDS = new Map([
    ['null', 'null'],
    ['undefined', 'undefined'],
    ['NaN', 'nan'],
    ['Number.NaN', 'nan'],
    ['true', 'true'],
    ['false', 'false'],
]);

export const NULLISH_KINDS = new Set(['null', 'undefined']);

export const VALUE_KINDS = new Set(['null', 'undefined', 'nan']);

export const BOOLEAN_KINDS = new Set(['true', 'false']);

export const EQUALITY_OPERATORS = new Set(['===', '!==']);

export const NUMERIC_MATCHERS = new Map([
    ['>', 'above'],
    ['>=', 'atLeast'],
    ['<', 'below'],
    ['<=', 'atMost'],
]);

export const INVERTED_OPERATORS = new Map([
    ['>', '<='],
    ['>=', '<'],
    ['<', '>='],
    ['<=', '>'],
]);

export const NUMERIC_SIGNS = new Set(['+', '-']);

export const NUMBER_TYPES = new Set(['number', 'bigint']);

export const NUMERIC_NAME =
    /^[\w$.]*(?:amount|count|delta|depth|diff|duration|elapsed|height|index|length|level|limit|number|price|score|size|total|width)$/iu;

export const TEXT_RECEIVER = /^(?:[\w$]*(?:text|string|message|content|html)|'[^'\\]*'|"[^"\\]*"|`[^`\\$]*`)$/iu;

export const BARE_RECEIVERS = new Set(['Identifier', 'MemberExpression', 'CallExpression', 'ThisExpression']);

export const JASMINE_PACKAGES = ['jasmine-core', 'jasmine'];

export const JASMINE_SIZE_VERSION = [3, 6, 0];

export const ASSERT_MESSAGE_INDEX = 2;

export const TEMPLATE_FIELD = /\{(\w+)\}/gu;

export const MATCHER_TEMPLATES = new Map<string, readonly string[]>([
    ['jest.null', ['expect({received}).toBeNull()', 'expect({received}).not.toBeNull()']],
    ['jest.undefined', ['expect({received}).toBeUndefined()', 'expect({received}).toBeDefined()']],
    ['jest.nan', ['expect({received}).toBeNaN()', 'expect({received}).not.toBeNaN()']],
    ['jest.length', ['expect({received}).toHaveLength({expected})', 'expect({received}).not.toHaveLength({expected})']],
    ['jest.size', ['expect({received}).toHaveSize({expected})', 'expect({received}).not.toHaveSize({expected})']],
    ['jest.equal', ['expect({received}).toBe({expected})', 'expect({received}).not.toBe({expected})']],
    [
        'jest.instance',
        ['expect({received}).toBeInstanceOf({expected})', 'expect({received}).not.toBeInstanceOf({expected})'],
    ],
    ['jest.include', ['expect({received}).toContain({expected})', 'expect({received}).not.toContain({expected})']],
    ['jest.above', ['expect({received}).toBeGreaterThan({expected})']],
    ['jest.atLeast', ['expect({received}).toBeGreaterThanOrEqual({expected})']],
    ['jest.below', ['expect({received}).toBeLessThan({expected})']],
    ['jest.atMost', ['expect({received}).toBeLessThanOrEqual({expected})']],
    ['chai-expect.null', ['expect({received}{message}).to.be.null', 'expect({received}{message}).to.not.be.null']],
    [
        'chai-expect.undefined',
        ['expect({received}{message}).to.be.undefined', 'expect({received}{message}).to.not.be.undefined'],
    ],
    [
        'chai-expect.length',
        [
            'expect({received}{message}).to.have.lengthOf({expected})',
            'expect({received}{message}).to.not.have.lengthOf({expected})',
        ],
    ],
    [
        'chai-expect.equal',
        ['expect({received}{message}).to.equal({expected})', 'expect({received}{message}).to.not.equal({expected})'],
    ],
    [
        'chai-expect.instance',
        [
            'expect({received}{message}).to.be.instanceOf({expected})',
            'expect({received}{message}).to.not.be.instanceOf({expected})',
        ],
    ],
    [
        'chai-expect.include',
        [
            'expect({received}{message}).to.include({expected})',
            'expect({received}{message}).to.not.include({expected})',
        ],
    ],
    ['chai-expect.above', ['expect({received}{message}).to.be.above({expected})']],
    ['chai-expect.atLeast', ['expect({received}{message}).to.be.at.least({expected})']],
    ['chai-expect.below', ['expect({received}{message}).to.be.below({expected})']],
    ['chai-expect.atMost', ['expect({received}{message}).to.be.at.most({expected})']],
    ['chai-should.null', ['{received}.should.be.null', '{received}.should.not.be.null']],
    ['chai-should.undefined', ['{received}.should.be.undefined', '{received}.should.not.be.undefined']],
    [
        'chai-should.length',
        ['{received}.should.have.lengthOf({expected})', '{received}.should.not.have.lengthOf({expected})'],
    ],
    ['chai-should.equal', ['{received}.should.equal({expected})', '{received}.should.not.equal({expected})']],
    [
        'chai-should.instance',
        ['{received}.should.be.instanceOf({expected})', '{received}.should.not.be.instanceOf({expected})'],
    ],
    ['chai-should.include', ['{received}.should.include({expected})', '{received}.should.not.include({expected})']],
    ['chai-should.above', ['{received}.should.be.above({expected})']],
    ['chai-should.atLeast', ['{received}.should.be.at.least({expected})']],
    ['chai-should.below', ['{received}.should.be.below({expected})']],
    ['chai-should.atMost', ['{received}.should.be.at.most({expected})']],
    ['chai-assert.null', ['{assert}.isNull({received}{message})', '{assert}.isNotNull({received}{message})']],
    ['chai-assert.undefined', ['{assert}.isUndefined({received}{message})', '{assert}.isDefined({received}{message})']],
    ['chai-assert.length', ['{assert}.lengthOf({received}, {expected}{message})']],
    [
        'chai-assert.equal',
        [
            '{assert}.strictEqual({received}, {expected}{message})',
            '{assert}.notStrictEqual({received}, {expected}{message})',
        ],
    ],
    [
        'chai-assert.instance',
        [
            '{assert}.instanceOf({received}, {expected}{message})',
            '{assert}.notInstanceOf({received}, {expected}{message})',
        ],
    ],
    [
        'chai-assert.include',
        ['{assert}.include({received}, {expected}{message})', '{assert}.notInclude({received}, {expected}{message})'],
    ],
    ['chai-assert.above', ['{assert}.isAbove({received}, {expected}{message})']],
    ['chai-assert.atLeast', ['{assert}.isAtLeast({received}, {expected}{message})']],
    ['chai-assert.below', ['{assert}.isBelow({received}, {expected}{message})']],
    ['chai-assert.atMost', ['{assert}.isAtMost({received}, {expected}{message})']],
    ['cypress.null', ["{received}.{method}('be.null')", "{received}.{method}('not.be.null')"]],
    ['cypress.undefined', ["{received}.{method}('be.undefined')", "{received}.{method}('not.be.undefined')"]],
]);

export const LOCATOR_FACTORIES = new Set([
    'getByRole',
    'getByText',
    'getByLabel',
    'getByPlaceholder',
    'getByAltText',
    'getByTitle',
    'getByTestId',
    'locator',
    'frameLocator',
]);

export const LOCATOR_STATES = new Map([
    ['isVisible', ['toBeVisible', 'toBeHidden']],
    ['isHidden', ['toBeHidden', 'toBeVisible']],
    ['isEnabled', ['toBeEnabled', 'toBeDisabled']],
    ['isDisabled', ['toBeDisabled', 'toBeEnabled']],
    ['isChecked', ['toBeChecked', 'not.toBeChecked']],
]);

export const LOCATOR_VALUES = new Map([
    ['count', 'toHaveCount'],
    ['inputValue', 'toHaveValue'],
]);

export const TYPE_CATEGORIES = new Map([
    ['string', 'string'],
    ['number', 'number'],
    ['boolean', 'boolean'],
    ['true', 'boolean'],
    ['false', 'boolean'],
    ['bigint', 'bigint'],
    ['symbol', 'symbol'],
    ['unique symbol', 'symbol'],
    ['null', 'null'],
    ['undefined', 'undefined'],
    ['void', 'undefined'],
    ['any', 'unknown'],
    ['unknown', 'unknown'],
    ['never', 'unknown'],
]);

export const OPEN_CATEGORIES = new Set(['object', 'null', 'undefined', 'unknown']);
