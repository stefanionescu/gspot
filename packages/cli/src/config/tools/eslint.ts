import { ESLINT_WARN, ESLINT_ERROR } from '#cli/config/parsers/output.ts';

// The native ESLint severities that activate a rule.
export const ACTIVE_SEVERITIES = new Set<unknown>([ESLINT_WARN, ESLINT_ERROR, 'warn', 'error']);

export const ESLINT_WORKER_FILES = {
    source: 'worker.ts',
    bundle: 'worker.js',
} as const;
