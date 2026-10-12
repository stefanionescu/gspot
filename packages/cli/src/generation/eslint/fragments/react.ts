import { presetSource, eslintErrorRules } from '#cli/generation/eslint/serialize.ts';
import { REACT_RULES, JSX_CODE_FILES } from '#cli/config/generation/eslint-fragments.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
/**
 * Write react ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 *
 * @returns the ESLint fragment source.
 */
export function reactFragment({
    eslintPresets,
    eslintModule,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule'>): string {
    const output: string[] = [
        "import reactHooks from 'eslint-plugin-react-hooks';\nimport react from 'eslint-plugin-react';\nimport reactRefresh from 'eslint-plugin-react-refresh';\n",
    ];
    const presets = eslintPresets('react') as FragmentPresets;
    output.push(
        '\n',
        eslintModule.block(
            {
                files: JSX_CODE_FILES,
                rules: {
                    ...presets.recommended.blocks[0].rules,
                    ...presets.jsx.blocks[0].rules,
                    ...(presets.hooks.blocks[0].rules === undefined
                        ? {}
                        : eslintErrorRules(presets.hooks.blocks[0].rules)),
                    ...presets.refresh.blocks[0].rules,
                    ...REACT_RULES,
                },
            },
            `plugins: { 'react-hooks': reactHooks, react, 'react-refresh': reactRefresh }, languageOptions: ${presetSource('react', presets.recommended.source)}.languageOptions, settings: { react: { version: 'detect' } }`,
            {
                expression: `{ ...${presetSource('react', presets.recommended.source)}.rules, ...${presetSource('react', presets.jsx.source)}.rules, ...${presetSource('reactHooks', presets.hooks.source)}.rules, ...${presetSource('reactRefresh', presets.refresh.source)}.rules }`,
                rules: {
                    ...presets.recommended.blocks[0].rules,
                    ...presets.jsx.blocks[0].rules,
                    ...presets.hooks.blocks[0].rules,
                    ...presets.refresh.blocks[0].rules,
                },
            },
        ),
        ',\n',
    );
    return output.join('');
}
