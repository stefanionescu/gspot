// The literal values checks/typescript reads: names, patterns, limits, and tables.

/** Compiler flags that add diagnostics without changing module resolution or emitted JavaScript. */
export const RECOMMENDED_COMPILER_OPTIONS = { strict: true };
// Nest injects by the emitted types of constructor parameters, which takes both decorator options.
export const DECORATOR_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true };
export const ESLINT_FILE = '.gspot/config/eslint.config.mjs';
export const LINT_CHECKS = ['javascript/eslint', 'typescript/eslint'];
