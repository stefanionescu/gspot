// The literal values evaluation reads: names, patterns, limits, and tables.

/** The numeric severities ESLint accepts beside warn and error. */
export const ESLINT_WARN = 1;
export const ESLINT_ERROR = 2;
// The ESLint severities that switch a rule on.
export const ACTIVE_LEVELS = new Set<unknown>([ESLINT_WARN, ESLINT_ERROR, 'warn', 'error']);
