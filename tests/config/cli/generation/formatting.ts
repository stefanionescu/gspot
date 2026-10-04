import type { PrettierPlugin } from '#cli/types/generation/formatting.ts';

/** Inventory declarations precede ordered authored Prettier patterns. */
export const IGNORE_POLICY = {
    configurations: ['format'],
    exclude: ['excluded/**'],
    generated: [{ paths: ['generated/**'], reason: 'A checked-in generator produces these sources.' }],
    vendored: [{ paths: ['vendored/**'], reason: 'The upstream package owns these sources.' }],
    tools: { prettier: { exclude: ['authored/*', '!authored/kept.ts'] } },
};

/** Real authored files stay eligible while declarations, ordinary excludes, and consumable locks stay ignored. */
export const IGNORE_CASES = [
    { file: 'tests/build/Scenario.ts', ignored: false },
    { file: 'src/dist/source.ts', ignored: false },
    { file: 'coverage/source.ts', ignored: false },
    { file: 'build/source.ts', ignored: false },
    { file: 'excluded/source.ts', ignored: true },
    { file: 'generated/source.ts', ignored: true },
    { file: 'vendored/source.ts', ignored: true },
    { file: 'authored/omitted.ts', ignored: true },
    { file: 'authored/kept.ts', ignored: false },
    { file: 'package-lock.json', ignored: true },
    { file: 'pnpm-lock.yaml', ignored: true },
];

export const SVELTE_PLUGIN: PrettierPlugin = {
    name: 'prettier-plugin-svelte',
    entry: 'plugin.js',
    overrides: [{ files: '*.svelte', options: { embeddedLanguageFormatting: 'auto' } }],
};
