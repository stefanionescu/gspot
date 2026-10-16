import { serializeBlocks } from '#cli/generation/eslint/print.ts';
import { SVELTE_FILES, SVELTE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import { promotePresetRules, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply Svelte presets and select typed component parsing.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildSvelteFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'eslintModule' | 'configurations'>,
): EslintFragment {
    const { eslintPresets, eslintModule, configurations } = context;

    const imports: string[] = [
        "import sveltePlugin from 'eslint-plugin-svelte';",
        "import svelteParser from 'svelte-eslint-parser';",
    ];

    const output: string[] = ['\n\n'];
    const presets = eslintPresets.get('svelte') as FragmentPresets;
    const typed = configurations.includes('typescript');
    output.push(
        serializeBlocks(eslintModule, buildArrayPresetBlocks(presets.recommended, 'sveltePlugin', promotePresetRules)),
        '\n',
        eslintModule.block(
            {
                files: SVELTE_FILES,
                rules: SVELTE_RULES,
            },
            `languageOptions: { parser: svelteParser, parserOptions: { ${typed ? 'parser: { ts: tseslint.parser, typescript: tseslint.parser },' : ''} extraFileExtensions: ['.svelte'] } }`,
        ),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildSvelteFragment };
