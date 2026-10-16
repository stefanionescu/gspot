import { serializeBlocks } from '#cli/generation/eslint/print.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { SVELTE_FILES, SVELTE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import { pickPresetFields, buildPresetBlocks } from '#cli/generation/eslint/presets.ts';
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
        serializeBlocks(
            eslintModule,
            buildPresetBlocks(presets.recommended, 'sveltePlugin', (block, index, source) => [
                {
                    ...pickPresetFields(block),
                    ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
                },
                `...${source}[${String(index)}]`,
                {
                    expression: `${source}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ]),
        ),
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
