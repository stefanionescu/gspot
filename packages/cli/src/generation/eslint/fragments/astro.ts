import { pickPresetFields } from '#cli/generation/eslint/presets.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { serializeBlocks, serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { ASTRO_FILES, ASTRO_RULES, ASTRO_SCRIPT_FILES } from '#cli/config/generation/eslint-fragments.ts';
import type { EslintModule, FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write astro ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.configurations the selected configuration names.
 *
 * @returns the ESLint fragment source.
 */
export function buildAstroFragment({
    eslintPresets,
    eslintModule,
    configurations,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'configurations'>): string {
    const presets = eslintPresets('astro') as FragmentPresets;
    const blocks: Parameters<EslintModule['block']>[] = (['recommended', 'accessibility'] as const).flatMap((name) => {
        const preset = presets[name];
        const source = serializePresetAccess('astroPlugin', preset.source);
        return preset.blocks.map(
            (block, index): Parameters<EslintModule['block']> => [
                {
                    ...pickPresetFields(block),
                    files: block.files ?? ASTRO_FILES,
                    ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
                },
                `...${source}[${String(index)}]`,
                { expression: `${source}[${String(index)}].rules`, rules: block.rules },
            ],
        );
    });
    blocks.push([
        { files: ASTRO_FILES, rules: ASTRO_RULES },
        'languageOptions: { parserOptions: { tsconfigRootDir: root } }',
    ]);
    if (configurations.includes('typescript')) {
        const preset = (eslintPresets('typescript') as FragmentPresets).untyped;
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
    return "import astroPlugin from 'eslint-plugin-astro';\n" + serializeBlocks(eslintModule, blocks) + '\n';
}
