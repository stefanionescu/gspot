import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';

export const ESCAPED_SCOPE_CONFIGURATIONS = ['javascript', 'react'] as const;

export const ESLINT_FILE = findManifestTarget('javascript', 'eslint/eslint.mjs');
