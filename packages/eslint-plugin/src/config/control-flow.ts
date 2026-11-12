export const STEP_OPERATORS = new Set(['+=', '-=']);

export const LABEL_OWNERS: ReadonlySet<string> = new Set(['FunctionDeclaration', 'FunctionExpression', 'SwitchCase']);

export const INCREMENT_OPERATORS = new Set(['++', '+=']);

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

export const TERMINATING_STATEMENTS: ReadonlySet<string | undefined> = new Set([
    'ReturnStatement',
    'ThrowStatement',
    'BreakStatement',
    'ContinueStatement',
]);
