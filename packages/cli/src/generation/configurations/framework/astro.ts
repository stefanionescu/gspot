import { TYPESCRIPT_CONFIGURATION } from '#cli/config/configurations/names.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    ASTRO_RULES,
    ASTRO_FILES,
    ASTRO_TYPED_RULES,
    ASTRO_SCRIPT_FILES,
} from '#cli/config/generation/configurations/framework/astro.ts';
import {
    getPreset,
    buildPresetRules,
    setFocusableRoles,
    buildArrayPresetBlocks,
    convertWarningsToErrors,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply Astro's presets and its component parser.

@param scope the selected presets and configurations.
*/
export function buildAstroBlocks(
    scope: Pick<EslintScope, 'presets' | 'eslintPresets' | 'settings'>,
): ConfigurationBlocks {
    const { presets, eslintPresets, settings } = scope;
    const blocks: ConfigurationBlocks['blocks'] = ['recommended', 'accessibility'].flatMap((name) =>
        buildArrayPresetBlocks(getPreset(presets, name), 'astroPlugin', ({ parser: _parser, ...fields }) => ({
            ...fields,
            files: fields.files ?? ASTRO_FILES,
            ...(fields.rules !== undefined && {
                rules: setFocusableRoles(convertWarningsToErrors(fields.rules)),
            }),
        })),
    );
    blocks.push({
        fields: { files: ASTRO_FILES, rules: ASTRO_RULES },
        calls: [
            { name: 'setRootFolder', args: [{ value: [['languageOptions', 'parserOptions', 'tsconfigRootDir']] }] },
        ],
    });
    if (settings.configurations.includes(TYPESCRIPT_CONFIGURATION)) {
        const preset = getPreset(eslintPresets.get(TYPESCRIPT_CONFIGURATION), 'untyped');
        const { parser: _parser, ...untyped } = preset.blocks[0];
        blocks.push(
            {
                fields: {
                    files: ASTRO_FILES,
                    rules: ASTRO_TYPED_RULES,
                    processor: 'astro/client-side-ts',
                    languageOptions: {
                        parserOptions: { project: true, projectService: false, extraFileExtensions: ['.astro'] },
                    },
                },
                calls: [{ name: 'setScriptParser', args: [{ importName: 'tseslint', path: 'parser' }] }],
            },
            {
                fields: { files: ASTRO_SCRIPT_FILES, ...untyped },
                preset: {
                    ...buildPresetRules([['tseslint', preset]]),
                    sources: [{ importName: 'tseslint', path: preset.source, includeFields: true }],
                },
            },
        );
    }
    return { imports: CONFIGURATION_PLUGINS.astro, blocks };
}
