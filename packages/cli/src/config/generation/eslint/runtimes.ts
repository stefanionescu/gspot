/** CommonJS file extensions preserve their module globals. */
export const COMMONJS_FILES = '**/*.{cjs,cts}';

/** Frameworks whose application files use browser APIs. Their build scripts keep Node.js. */
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;
