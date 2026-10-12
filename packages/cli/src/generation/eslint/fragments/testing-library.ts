import { presetSource, eslintErrorRules } from '#cli/generation/eslint/serialize.ts';
import { TESTING_LIBRARY_DEFAULT_PRESET } from '#cli/config/generation/eslint-fragments.ts';
import type { EslintPresets, FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
/**
 * Write testingLibrary ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.scopeDependencies the dependency names in this scope.
 *
 * @returns the ESLint fragment source.
 */
export function testingLibraryFragment({
    eslintPresets,
    eslintModule,
    eslintFiles,
    scopeDependencies,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'scopeDependencies'>): string {
    const output: string[] = ["import testingLibrary from 'eslint-plugin-testing-library';\n"];
    const presets = eslintPresets('testing-library') as FragmentPresets;
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
                eslintModule.block(
                    {
                        files: eslintFiles.tests,
                        ...(block.rules === undefined ? {} : { rules: eslintErrorRules(block.rules) }),
                    },
                    "plugins: { 'testing-library': testingLibrary }",
                    {
                        expression: `${presetSource('testingLibrary', preset.source)}.rules`,
                        rules: block.rules,
                    },
                ),
                ',\n',
            );
        }
    }
    output.push('\n');
    return output.join('');
}
