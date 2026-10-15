import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { REACT_NATIVE_RULES } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Write reactNative ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function reactNativeFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        "import reactNativePlatform from '@react-native/eslint-plugin';\nimport reactNative from 'eslint-plugin-react-native';\n",

        eslintModule.block(
            {
                files: eslintFiles.code,
                rules: REACT_NATIVE_RULES,
            },
            "plugins: { '@react-native': reactNativePlatform, 'react-native': reactNative }",
        ),
        ',\n',
    ];
    return output.join('');
}
