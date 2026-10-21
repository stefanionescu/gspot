import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { getPreset, buildPresetRuleExpression } from '#cli/generation/eslint/presets.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';

import {
    FRAGMENT_IMPORTS,
    TESTING_LIBRARY_SCOPE,
    TESTING_LIBRARY_DEFAULT_PRESET,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply the Testing Library presets of the frameworks in use.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildTestingLibraryFragment(
    context: Pick<EslintFragmentContext, 'presets' | 'eslintFiles' | 'scopeDependencies'>,
): EslintFragment {
    const { presets, eslintFiles, scopeDependencies } = context;
    const blocks: EslintFragment['blocks'] = [];
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
        imports: FRAGMENT_IMPORTS['testing-library'],
        blocks,
    };
}
export { buildTestingLibraryFragment };
