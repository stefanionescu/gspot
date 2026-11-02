export const STEP_OPERATORS = new Set(['+=', '-=']);

export const INCREMENT_OPERATORS = new Set(['++', '+=']);

export const INEQUALITY_OPERATORS = new Set(['!=', '!==']);

export const DECIMAL_LITERAL = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/u;

export const FRACTION_MARKER = /[.e]/u;

export const DECIMAL_FACTOR = 5n;

export const BINARY_FACTOR = 2;

export const SIGNS = new Set(['-', '+']);

export const RANGE_OPERATORS: ReadonlyMap<string, readonly string[]> = new Map([
    ['&&', ['<=', '>=']],
    ['||', ['<', '>']],
]);

export const FLOAT_ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '%', '**']);

export const BITWISE_JOINS = new Set(['&', '|']);

export const BITWISE_OPERATORS = new Set(['&', '|', '^', '<<', '>>', '>>>']);

export const BIGINT_ZERO = 0n;
