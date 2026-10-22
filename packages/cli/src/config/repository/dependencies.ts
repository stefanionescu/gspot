/** A tool-only package may hold these hook managers, and gspot does not install them. */
export const HOOK_PACKAGES: ReadonlySet<string> = new Set(['husky', 'lefthook', 'lint-staged']);
