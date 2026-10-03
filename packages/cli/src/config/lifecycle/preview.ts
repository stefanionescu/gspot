// The literal values lifecycle/preview reads: names, patterns, limits, and tables.
import { ESLINT_WARN, ESLINT_ERROR } from '#cli/config/policy/policy.ts';

// The ESLint severities that switch a rule on.
export const ACTIVE_SEVERITIES = new Set<unknown>([ESLINT_WARN, ESLINT_ERROR, 'warn', 'error']);

export const BYTE_ORDER_MARK = '\uFEFF';
export const KEY_QUOTES = ['"', '`'];
export const VALUE_QUOTES = ['"""', '`'];

export const SHELLCHECK_DIRECTIVE = /^([a-zA-Z-]+)=/u;
export const SHELLCHECK_RULE_NAME = /^[a-zA-Z-]+$/u;
export const SHELLCHECK_RULE_CODE = /^(?:SC)?\d+$/u;
