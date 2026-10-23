import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/configurations/language/javascript/eslint/print.ts';

import {
    ASTRO_RULES,
    ASTRO_FILES,
    ASTRO_TYPED_RULES,
    ASTRO_SCRIPT_FILES,
} from '#cli/config/generation/configurations/framework/astro.ts';
import {
    CONFIGURATION_PLUGINS,
    TYPESCRIPT_CONFIGURATION,
} from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';
import {
    getPreset,
    allowFocusableRegions,
    buildArrayPresetBlocks,
    convertWarningsToErrors,
    buildPresetRuleExpression,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
 * Apply Astro's presets and its component parser.
 *
 * @param scope the selected presets and configurations.
 * @returns imported bindings and unscoped block data.
 */
export function buildAstroBlocks(
    scope: Pick<EslintScope, 'presets' | 'eslintPresets' | 'settings'>,
): ConfigurationBlocks {
    const { presets, eslintPresets, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = ['recommended', 'accessibility'].flatMap((name) =>
        buildArrayPresetBlocks(getPreset(presets, name), 'astroPlugin', ({ parser: _parser, ...fields }) => ({
            ...fields,
            files: fields.files ?? ASTRO_FILES,
            ...(fields.rules === undefined
                ? {}
                : { rules: allowFocusableRegions(convertWarningsToErrors(fields.rules)) }),
        })),
    );
    blocks.push({
        fields: { files: ASTRO_FILES, rules: ASTRO_RULES },
        properties: 'languageOptions: { parserOptions: { tsconfigRootDir: root } }',
    });
    if (settings.configurations.includes(TYPESCRIPT_CONFIGURATION)) {
        const preset = getPreset(eslintPresets.get(TYPESCRIPT_CONFIGURATION), 'untyped');
        const { parser: _parser, ...untyped } = preset.blocks[0];
        const source = serializePresetAccess('tseslint', preset.source);
        blocks.push(
            {
                fields: { files: ASTRO_FILES, rules: ASTRO_TYPED_RULES },
                properties:
                    "processor: 'astro/client-side-ts', languageOptions: { parserOptions: { parser: tseslint.parser, projectService: false, project: true } }",
            },
            {
                fields: { files: ASTRO_SCRIPT_FILES, ...untyped },
                properties: `...${source}`,
                preset: buildPresetRuleExpression([['tseslint', preset]]),
            },
        );
    }
    return { imports: CONFIGURATION_PLUGINS.astro, blocks };
}
