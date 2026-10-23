import { findFileTarget } from '#tests/setup/cli/config-files.ts';

export const ESCAPED_SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

export const ESLINT_FILE = findFileTarget('javascript', 'eslint/eslint.mjs');
