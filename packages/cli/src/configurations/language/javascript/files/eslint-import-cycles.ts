import type { keepCycleFields } from '#cli/configurations/language/javascript/files/eslint-functions.ts';
import type { JavascriptBlock } from '#cli/types/configurations/javascript.ts';

// The two generated siblings exist only beside the generated copy of this file, so it loads them at run time.
const [eslint, functions] = (await Promise.all([
    import(new URL('eslint.mjs', import.meta.url).href),
    import(new URL('functions.mjs', import.meta.url).href),
])) as [{ default: JavascriptBlock[] }, { keepCycleFields: typeof keepCycleFields }];

const blocks = eslint.default.map((block) => functions.keepCycleFields(block));

export default [
    ...blocks,
    {
        linterOptions: { reportUnusedDisableDirectives: 'off' },
        settings: { 'import-x/cache': { lifetime: Infinity } },
        rules: { 'import-x/no-cycle': ['error', { ignoreExternal: true }] },
    },
];
