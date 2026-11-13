// comparison operators
export const EQUALITY_OPERATORS = new Set(['==', '===', '!=', '!==']);
export const COMPARISON_OPERATORS = new Set([...EQUALITY_OPERATORS, '<', '<=', '>', '>=']);
export const INEQUALITY_OPERATORS = new Set(['!=', '!==']);

// no-bitwise-in-condition rule
export const BITWISE_JOINS = new Set(['&', '|']);
export const BITWISE_OPERATORS = new Set(['&', '|', '^', '<<', '>>', '>>>']);
export const CONDITION_PARENTS: ReadonlySet<string> = new Set([
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'DoWhileStatement',
    'ConditionalExpression',
]);

// no-floating-point-equality rule
export const BIGINT_ZERO = 0n;
export const BINARY_FACTOR = 2;
export const DECIMAL_FACTOR = 5n;
export const DECIMAL_LITERAL = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/u;
export const FLOAT_ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '%', '**']);
export const FRACTION_MARKER = /[.e]/u;
export const RANGE_OPERATORS: ReadonlyMap<string, readonly string[]> = new Map([
    ['&&', ['<=', '>=']],
    ['||', ['<', '>']],
]);

// no-identical-operands rule
export const REPEATED_OPERATORS = new Set(['&&', '||', '/', '-', '<<', '>>', '<', '<=', '>', '>=']);
export const UNIT_SHIFT_VALUES = new Set<unknown>([1, 1n]);

// no-redundant-boolean rule
export const LOOSE_EQUALITY_OPERATORS = new Set(['==', '!=']);
