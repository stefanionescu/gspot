import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { getPreset, convertWarningsToErrors, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';

import {
    CONFIGURATION_PLUGINS,
    TESTING_LIBRARY_SCOPE,
    TESTING_LIBRARY_DEFAULT_PRESET,
} from '#cli/config/generation/eslint/configurations.ts';

/**
 * Apply the Testing Library presets of the frameworks in use.
 *
 * @param scope the planned ESLint file of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildTestingLibraryBlocks(
    scope: Pick<EslintScope, 'presets' | 'eslintFiles' | 'scopeDependencies'>,
): ConfigurationBlocks {
    const { presets, eslintFiles, scopeDependencies } = scope;
    const blocks: ConfigurationBlocks['blocks'] = [];
    const dependencies = scopeDependencies.filter((name) => name.startsWith(TESTING_LIBRARY_SCOPE));
    if (dependencies.length > 0) {
        const presetNames = dependencies
            .map((name) => name.slice(TESTING_LIBRARY_SCOPE.length))
            .filter((name) => presets?.[name] !== undefined);
        for (const name of new Set(presetNames.length === 0 ? [TESTING_LIBRARY_DEFAULT_PRESET] : presetNames)) {
            const preset = getPreset(presets, name);
            const block = preset.blocks[0];
            blocks.push({
                data: {
                    files: eslintFiles.tests,
                    ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
                },
                properties: "plugins: { 'testing-library': testingLibrary }",
                preset: buildPresetRuleExpression([['testingLibrary', preset]]),
            });
        }
    }
    return {
        imports: CONFIGURATION_PLUGINS['testing-library'],
        blocks,
    };
}
