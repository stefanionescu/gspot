export const COMPONENT_MATCHERS = {
    vue: 'componentMatches(vueParser)',
    svelte: 'componentMatches(svelteParser, tseslint.parser)',
} as const;

/** The functions of the shipped module, which a generated ESLint config file imports when its text calls them. */
export const ESLINT_FUNCTIONS = ['root', 'runtimeMatches', 'stripRuntimeGlobals', 'componentMatches'] as const;

/** The braces and spaces around the names of a named import, such as `{ createTypeScriptImportResolver }`. */
export const IMPORT_NAME_PUNCTUATION = /[{}\s]/gu;
