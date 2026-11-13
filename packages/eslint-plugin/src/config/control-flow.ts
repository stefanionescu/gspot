// max-switch-cases rule
export const DEFAULT_SWITCH_CASES = 30;
export const SWITCH_CASES_OPTIONS_SCHEMA = { type: 'integer', minimum: 0 } as const;

// no-equal-loop-condition rule
export const INCREMENT_OPERATORS = new Set(['++', '+=']);
export const STEP_OPERATORS = new Set(['+=', '-=']);

// no-ignored-catch rule
export const COMPLEX_TRY_STATEMENTS = /^(?:Block|For(?:In|Of)?|While|DoWhile|Switch)Statement$/u;

// no-small-switch rule
export const NEVER_TYPE = 'never';
export const SMALL_SWITCH_CASES = 2;

// no-switch-case-labels rule
export const LABEL_OWNERS: ReadonlySet<string> = new Set(['FunctionDeclaration', 'FunctionExpression', 'SwitchCase']);

// no-unthrown-error rule
export const ERROR_CONSTRUCTOR_SUFFIX = /(?:Error|Exception)$/u;

// no-updated-loop-counter rule
export const SPLICE_METHOD = 'splice';

// statement kinds
export const LOOP_STATEMENTS: ReadonlySet<string> = new Set(['WhileStatement', 'DoWhileStatement']);
export const LOOP_BODY_PARENTS: ReadonlySet<string> = new Set([
    ...LOOP_STATEMENTS,
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
]);
export const TERMINATING_STATEMENTS: ReadonlySet<string | undefined> = new Set([
    'ReturnStatement',
    'ThrowStatement',
    'BreakStatement',
    'ContinueStatement',
]);
