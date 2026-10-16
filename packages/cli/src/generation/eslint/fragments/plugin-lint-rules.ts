import { type EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

import {
    ZOD_RULES,
    JSX_FILES,
    EXPO_RULES,
    EXPRESS_RULES,
    REACT_NATIVE_RULES,
    TRANSLATIONS_RULES,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Write expo ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function expoFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        "import expoPlugin from 'eslint-plugin-expo';\n",
        eslintModule.block(
            {
                files: eslintFiles.code,
                rules: EXPO_RULES,
            },
            'plugins: { expo: expoPlugin }',
        ),
        ',\n',
    ];
    return output.join('');
}

/**
 * Write express ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function expressFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        eslintModule.block({
            files: eslintFiles.code,
            rules: EXPRESS_RULES,
        }),
        ',\n',
    ];
    return output.join('');
}

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

/**
 * Write zod ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function zodFragment({
    eslintModule,
    eslintFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles'>): string {
    const output: string[] = [
        "import zodPlugin from 'eslint-plugin-zod';\n",
        eslintModule.block(
            {
                files: eslintFiles.code,
                rules: Object.fromEntries(ZOD_RULES.map((rule) => [`zod/${rule}`, 'error'])),
            },
            'plugins: { zod: zodPlugin }',
        ),
        ',\n',
    ];
    return output.join('');
}

/**
 * Write translations ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.testFiles the root-relative test file selectors.
 *
 * @returns the ESLint fragment source.
 */
export function translationsFragment({
    eslintModule,
    testFiles,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'testFiles'>): string {
    const output: string[] = ["import i18next from 'eslint-plugin-i18next';\n"];
    {
        output.push(
            '\n',
            eslintModule.block(
                {
                    files: JSX_FILES,
                    ignores: testFiles,
                    rules: TRANSLATIONS_RULES,
                },
                'plugins: { i18next }',
            ),
            ',\n',
        );
    }
    output.push('\n');
    return output.join('');
}
