export const COMPONENT_MATCHERS = {
    vue: 'componentMatches(vueParser)',
    svelte: 'componentMatches(svelteParser, tseslint.parser)',
} as const;

export const ESLINT_FUNCTIONS = ['root', 'runtimeMatches', 'stripRuntimeGlobals', 'componentMatches'] as const;

export const IMPORT_NAME_PUNCTUATION = /[{}\s]/gu;
