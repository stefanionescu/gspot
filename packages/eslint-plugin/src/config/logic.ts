export const STEP_OPERATORS = new Set(['+=', '-=']);

export const LABEL_OWNERS: ReadonlySet<string> = new Set(['FunctionDeclaration', 'FunctionExpression', 'SwitchCase']);

export const INCREMENT_OPERATORS = new Set(['++', '+=']);

export const INEQUALITY_OPERATORS = new Set(['!=', '!==']);

export const DECIMAL_LITERAL = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/u;

export const FRACTION_MARKER = /[.e]/u;

export const DECIMAL_FACTOR = 5n;

export const BINARY_FACTOR = 2;

export const RANGE_OPERATORS: ReadonlyMap<string, readonly string[]> = new Map([
    ['&&', ['<=', '>=']],
    ['||', ['<', '>']],
]);

export const FLOAT_ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '%', '**']);

export const BITWISE_JOINS = new Set(['&', '|']);

export const BITWISE_OPERATORS = new Set(['&', '|', '^', '<<', '>>', '>>>']);

export const BIGINT_ZERO = 0n;

export const EQUALITY_OPERATORS = new Set(['==', '===', '!=', '!==']);

export const REPEATED_OPERATORS = new Set(['&&', '||', '/', '-', '<<', '>>', '<', '<=', '>', '>=']);

export const COMPARISON_OPERATORS = new Set([...EQUALITY_OPERATORS, '<', '<=', '>', '>=']);

export const UNIT_SHIFT_VALUES = new Set<unknown>([1, 1n]);

export const LOOSE_EQUALITY_OPERATORS = new Set(['==', '!=']);

export const CONDITION_PARENTS: ReadonlySet<string> = new Set([
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'DoWhileStatement',
    'ConditionalExpression',
]);

export const DEFAULT_SWITCH_CASES = 30;

export const SWITCH_CASES_OPTIONS_SCHEMA = { type: 'integer', minimum: 0 } as const;

export const SMALL_SWITCH_CASES = 2;

export const ERROR_CONSTRUCTOR_SUFFIX = /(?:Error|Exception)$/u;

export const COMPLEX_TRY_STATEMENTS = /^(?:Block|For(?:In|Of)?|While|DoWhile|Switch)Statement$/u;

export const NEVER_TYPE = 'never';

export const SPLICE_METHOD = 'splice';

export const LOOP_STATEMENTS: ReadonlySet<string> = new Set(['WhileStatement', 'DoWhileStatement']);

export const LOOP_BODY_PARENTS: ReadonlySet<string> = new Set([
    ...LOOP_STATEMENTS,
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
]);
