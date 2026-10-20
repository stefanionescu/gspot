import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { TESTING_LIBRARY_DEFAULT_PRESET } from '#cli/config/generation/eslint-fragments.ts';

import {
    type EslintPresets,
    type EslintContext,
    type EslintFragment,
    type FragmentPresets,
} from '#cli/types/generation/eslint.ts';

/**
 * Apply the Testing Library presets of the frameworks in use.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildTestingLibraryFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'eslintFiles' | 'scopeDependencies'>,
): EslintFragment {
    const { eslintPresets, blockWriter, eslintFiles, scopeDependencies } = context;

    const imports: string[] = ["import testingLibrary from 'eslint-plugin-testing-library';"];

    const output: string[] = ['\n'];
    const presets = eslintPresets.get('testing-library') as FragmentPresets;
    const dependencies = scopeDependencies.filter((name) => name.startsWith('@testing-library/'));
    if (dependencies.length > 0) {
        const presetNames = dependencies
            .map((name) => name.slice('@testing-library/'.length))
            .filter((name) => presets[name] !== undefined);
        for (const name of new Set(presetNames.length === 0 ? [TESTING_LIBRARY_DEFAULT_PRESET] : presetNames)) {
            const preset = presets[name] as EslintPresets[string];
            const block = preset.blocks[0] as EslintPresets[string]['blocks'][number];
            output.push(
                '\n',
                blockWriter.block(
                    {
                        files: eslintFiles.tests,
                        ...(block.rules === undefined ? {} : { rules: convertWarningsToErrors(block.rules) }),
                    },
                    "plugins: { 'testing-library': testingLibrary }",
                    {
                        expression: `${serializePresetAccess('testingLibrary', preset.source)}.rules`,
                        rules: block.rules,
                    },
                ),
                ',\n',
            );
        }
    }
    output.push('\n');
    return { imports: imports, blocks: output.join('') };
}

export { buildTestingLibraryFragment };
