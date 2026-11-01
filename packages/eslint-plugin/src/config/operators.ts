export const STEP_OPERATORS = new Set(['+=', '-=']);

export const INCREMENT_OPERATORS = new Set(['++', '+=']);

export const INEQUALITY_OPERATORS = new Set(['!=', '!==']);

export const DECIMAL_LITERAL = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/u;

export const FRACTION_MARKER = /[.e]/u;

export const DECIMAL_FACTOR = 5n;

export const BINARY_FACTOR = 2;

export const ASSERT_OPERANDS = 2;

export const SIGNS: ReadonlyMap<string, number> = new Map([
    ['-', -1],
    ['+', 1],
]);

export const RANGE_OPERATORS: ReadonlyMap<string, readonly string[]> = new Map([
    ['&&', ['<=', '>=']],
    ['||', ['<', '>']],
]);

export const FLOAT_ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '%', '**']);

export const CONSTANT_ARITHMETIC_OPERATORS: ReadonlyMap<string, (left: number, right: number) => number | undefined> =
    new Map([
        ['+', (left, right) => left + right],
        ['-', (left, right) => left - right],
        ['*', (left, right) => left * right],
        ['/', (left, right) => (right === 0 ? undefined : left / right)],
        ['%', (left, right) => (right === 0 ? undefined : left % right)],
        ['**', (left, right) => left ** right],
    ]);

export const ASSERTION_MATCHERS = new Set([
    'toBe',
    'toEqual',
    'toStrictEqual',
    'equal',
    'equals',
    'eq',
    'eql',
    'strictEqual',
    'notEqual',
    'notStrictEqual',
    'deepEqual',
    'deepStrictEqual',
]);

export const BITWISE_JOINS = new Set(['&', '|']);

export const BITWISE_OPERATORS = new Set(['&', '|', '^', '<<', '>>', '>>>']);

const FALSY_VALUES: ReadonlySet<unknown> = new Set([false, 0, 0n, '', null, undefined, Number.NaN]);

export const UNARY_EVALUATORS: ReadonlyMap<string, (value: unknown) => unknown> = new Map<
    string,
    (value: unknown) => unknown
>([
    ['-', (value: unknown) => -Number(value)],
    ['+', Number],
    ['~', (value: unknown) => ~Number(value)],
    ['!', (value: unknown) => FALSY_VALUES.has(value)],
    ['typeof', (value: unknown) => typeof value],
]);

export const BIGINT_ZERO = 0n;

export const ASSERT_NAME = 'assert';

export const EXPECT_NAME = 'expect';
