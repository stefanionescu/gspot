import { presetSource } from '#cli/generation/eslint/serialize.ts';
import { JSX_CODE_FILES } from '#cli/config/generation/eslint-fragments.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write reactDom ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.configurations the selected configuration names.
 *
 * @returns the ESLint fragment source.
 */
export function reactDomFragment({
    eslintPresets,
    eslintModule,
    configurations,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'configurations'>): string {
    const output: string[] = ["import accessibility from 'eslint-plugin-jsx-a11y';\n"];
    if (!configurations.includes('react-native')) {
        const preset = (eslintPresets('react-dom') as FragmentPresets).accessibility;
        output.push(
            '\n',
            eslintModule.block(
                {
                    files: JSX_CODE_FILES,
                    ...(preset.blocks[0].rules === undefined ? {} : { rules: preset.blocks[0].rules }),
                },
                "plugins: { 'jsx-a11y': accessibility }",
                {
                    expression: `${presetSource('accessibility', preset.source)}.rules`,
                    rules: preset.blocks[0].rules,
                },
            ),
            ',\n',
        );
    }
    output.push('\n');
    return output.join('');
}
