import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    TESTING_LIBRARY_SCOPE,
    TESTING_LIBRARY_DEFAULT_PRESET,
} from '#cli/config/generation/configurations/library/testing-library.ts';
import {
    getPreset,
    buildPresetRules,
    convertWarningsToErrors,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the Testing Library presets of the frameworks in use.

@param scope the planned ESLint file of the scope.
*/
export function buildTestingLibraryBlocks(
    scope: Pick<EslintScope, 'presets' | 'eslintFiles' | 'dependencies'>,
): ConfigurationBlocks {
    const { presets, eslintFiles, dependencies: scopeDependencies } = scope;
    const dependencies = scopeDependencies.filter((name) => name.startsWith(TESTING_LIBRARY_SCOPE));
    const presetNames = dependencies
        .map((name) => name.slice(TESTING_LIBRARY_SCOPE.length))
        .filter((name) => presets?.[name] !== undefined);
    const selected =
        dependencies.length === 0
            ? []
            : [...new Set(presetNames.length === 0 ? [TESTING_LIBRARY_DEFAULT_PRESET] : presetNames)];
    const blocks: ConfigurationBlocks['blocks'] = selected.map((name) => {
        const preset = getPreset(presets, name);
        const block = preset.blocks[0];
        return {
            fields: {
                files: eslintFiles.tests,
                ...(block.rules !== undefined && { rules: convertWarningsToErrors(block.rules) }),
            },
            calls: [{ name: 'addPlugins', args: [{ imports: { 'testing-library': 'testingLibrary' } }] }],
            preset: buildPresetRules([['testingLibrary', preset]]),
        };
    });
    return {
        imports: CONFIGURATION_PLUGINS['testing-library'],
        blocks,
    };
}
