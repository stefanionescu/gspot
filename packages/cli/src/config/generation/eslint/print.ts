import { JSON_INDENT } from '#cli/config/generation/generate.ts';

export const COMPONENT_MATCHERS = {
    vue: 'vueComponentMatches(vueParser)',
    svelte: 'svelteComponentMatches(svelteParser, tseslint.parser)',
} as const;

/** The indent of each generated ESLint block. */
export const ESLINT_INDENT = ' '.repeat(JSON_INDENT);

/** The ESLint runtime helper, which the ESLint config file imports from its own folder. */
const ESLINT_RUNTIME_FILE = 'eslint-runtime.mjs';

export const ESLINT_BASE_IMPORTS = [
    [
        '{ root, joinRoot, runtimeMatches, mergePresetRules, stripRuntimeGlobals, vueComponentMatches, svelteComponentMatches }',
        './' + ESLINT_RUNTIME_FILE,
    ],
    ['globals', 'globals'],
] as const;
