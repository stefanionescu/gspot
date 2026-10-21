import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import type { EslintFragment, EslintFragmentContext } from '#cli/types/generation/eslint.ts';

import {
    getPreset,
    allowFocusableRegions,
    buildArrayPresetBlocks,
    buildPresetRuleExpression,
} from '#cli/generation/eslint/presets.ts';
import {
    ASTRO_FILES,
    ASTRO_RULES,
    FRAGMENT_IMPORTS,
    ASTRO_TYPED_RULES,
    ASTRO_SCRIPT_FILES,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply Astro's presets and its component parser.
 *
 * @param context the selected presets and configurations.
 * @returns imported bindings and unscoped block data.
 */
function buildAstroFragment(
    context: Pick<EslintFragmentContext, 'presets' | 'eslintPresets' | 'view'>,
): EslintFragment {
    const { presets, eslintPresets, view } = context;
    const blocks: EslintFragment['blocks'] = ['recommended', 'accessibility'].flatMap((name) =>
        buildArrayPresetBlocks(getPreset(presets, name), 'astroPlugin', ({ parser: _parser, ...fields }) => ({
            ...fields,
            files: fields.files ?? ASTRO_FILES,
            ...(fields.rules === undefined
                ? {}
                : { rules: allowFocusableRegions(convertWarningsToErrors(fields.rules)) }),
        })),
    );
    blocks.push({
        data: { files: ASTRO_FILES, rules: ASTRO_RULES },
        properties: 'languageOptions: { parserOptions: { tsconfigRootDir: root } }',
    });
    if (view.configurations.includes(TYPESCRIPT_CONFIGURATION)) {
        const preset = getPreset(eslintPresets.get(TYPESCRIPT_CONFIGURATION), 'untyped');
        const { parser: _parser, ...untyped } = preset.blocks[0];
        const source = serializePresetAccess('tseslint', preset.source);
        blocks.push(
            {
                data: { files: ASTRO_FILES, rules: ASTRO_TYPED_RULES },
                properties:
                    "processor: 'astro/client-side-ts', languageOptions: { parserOptions: { parser: tseslint.parser, projectService: false, project: true } }",
            },
            {
                data: { files: ASTRO_SCRIPT_FILES, ...untyped },
                properties: `...${source}`,
                preset: buildPresetRuleExpression([['tseslint', preset]]),
            },
        );
    }
    return { imports: FRAGMENT_IMPORTS.astro, blocks };
}

export { buildAstroFragment };
