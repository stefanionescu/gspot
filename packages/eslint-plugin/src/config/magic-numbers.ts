/** The package whose no-magic-numbers rule gspot/no-magic-numbers wraps. gspot installs it with TypeScript. */
export const UPSTREAM_PACKAGE = '@typescript-eslint/eslint-plugin';
export const UPSTREAM_RULE = 'no-magic-numbers';

/** The nodes that start a new body, so a number inside them belongs to that code rather than to a constant. */
export const FUNCTION_NODES: ReadonlySet<string> = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]);
