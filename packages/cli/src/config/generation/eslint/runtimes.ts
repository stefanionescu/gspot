/** CommonJS file extensions preserve their module globals. */
export const COMMONJS_FILES = '**/*.{cjs,cts}';

/** Frameworks whose application sources use browser APIs. Build scripts retain Node.js. */
export const ESLINT_BROWSER_CONFIGURATIONS = ['react', 'vue', 'svelte'] as const;
