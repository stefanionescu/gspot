// The literal values the checks of typescript, jest, eslint-levels read: names, patterns, limits, and tables.
import { z } from 'zod';
import ruleLevels from './eslint-levels.json' with { type: 'json' };

/** Compiler flags that add diagnostics without changing module resolution or emitted JavaScript. */
export const RECOMMENDED_COMPILER_OPTIONS = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noFallthroughCasesInSwitch: true,
};
// Nest injects by the emitted types of constructor parameters, which takes both decorator options.
export const DECORATOR_OPTIONS = { experimentalDecorators: true, emitDecoratorMetadata: true };
export const ESLINT_FILE = '.gspot/config/eslint.config.mjs';
export const LINT_CHECKS = ['javascript/eslint', 'typescript/eslint'];

export const FULL_PERCENTAGE = 100;

/** Stable rule membership for generated defaults and required-rule validation. */
export const ESLINT_RULE_LEVELS = z.record(z.string(), z.enum(['recommended', 'all'])).parse(ruleLevels);
