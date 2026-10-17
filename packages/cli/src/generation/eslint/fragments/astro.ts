import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { pickPresetFields, buildPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { serializeBlocks, serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { ASTRO_FILES, ASTRO_RULES, ASTRO_SCRIPT_FILES } from '#cli/config/generation/eslint-fragments.ts';

import {
    type BlockWriter,
    type EslintContext,
    type EslintFragment,
    type FragmentPresets,
} from '#cli/types/generation/eslint.ts';

/**
 * Apply the Astro presets and the Astro component parser.
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildAstroFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'configurations'>,
): EslintFragment {
    const { eslintPresets, blockWriter, configurations } = context;

    const imports: string[] = ["import astroPlugin from 'eslint-plugin-astro';"];

    const presets = eslintPresets.get('astro') as FragmentPresets;
    const blocks: Parameters<BlockWriter['block']>[] = (['recommended', 'accessibility'] as const).flatMap((name) =>
        buildPresetBlocks(presets[name], 'astroPlugin', (block, index, source) => [
            {
                ...pickPresetFields(block),
                files: block.files ?? ASTRO_FILES,
                ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
            },
            `...${source}[${String(index)}]`,
            { expression: `${source}[${String(index)}].rules`, rules: block.rules },
        ]),
    );
    blocks.push([
        { files: ASTRO_FILES, rules: ASTRO_RULES },
        'languageOptions: { parserOptions: { tsconfigRootDir: root } }',
    ]);
    if (configurations.includes('typescript')) {
        const preset = (eslintPresets.get('typescript') as FragmentPresets).untyped;
        const untyped = pickPresetFields(preset.blocks[0]);
        const source = serializePresetAccess('tseslint', preset.source);
        blocks.push(
            [
                { files: ASTRO_FILES, rules: { '@typescript-eslint/no-unsafe-return': 'off' } },
                "processor: 'astro/client-side-ts', languageOptions: { parserOptions: { parser: tseslint.parser, projectService: false, project: true } }",
            ],
            [
                { files: ASTRO_SCRIPT_FILES, ...untyped },
                `...${source}`,
                { expression: `${source}.rules`, rules: untyped.rules },
            ],
        );
    }
    return { imports: imports, blocks: serializeBlocks(blockWriter, blocks) + '\n' };
}

export { buildAstroFragment };
