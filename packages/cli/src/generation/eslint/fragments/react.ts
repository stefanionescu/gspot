import { FRAGMENT_SPACING } from '#cli/config/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { REACT_RULES, JSX_CODE_FILES } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply the React, hooks, and refresh lint rules for the JSX mode.
 * @param context the presets and the block writer.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildReactFragment(context: Pick<EslintContext, 'eslintPresets' | 'blockWriter'>): EslintFragment {
    const { eslintPresets, blockWriter } = context;

    const imports: string[] = [
        "import reactHooks from 'eslint-plugin-react-hooks';",
        "import react from 'eslint-plugin-react';",
        "import reactRefresh from 'eslint-plugin-react-refresh';",
    ];

    const output: string[] = [FRAGMENT_SPACING];
    const presets = eslintPresets.get('react') as FragmentPresets;
    output.push(
        '\n',
        blockWriter.block(
            {
                files: JSX_CODE_FILES,
                rules: {
                    ...presets.recommended.blocks[0].rules,
                    ...presets.jsx.blocks[0].rules,
                    ...(presets.hooks.blocks[0].rules === undefined
                        ? {}
                        : convertWarningsToErrors(presets.hooks.blocks[0].rules)),
                    ...presets.refresh.blocks[0].rules,
                    ...REACT_RULES,
                },
            },
            `plugins: { 'react-hooks': reactHooks, react, 'react-refresh': reactRefresh }, languageOptions: ${serializePresetAccess('react', presets.recommended.source)}.languageOptions, settings: { react: { version: 'detect' } }`,
            {
                expression: `{ ...${serializePresetAccess('react', presets.recommended.source)}.rules, ...${serializePresetAccess('react', presets.jsx.source)}.rules, ...${serializePresetAccess('reactHooks', presets.hooks.source)}.rules, ...${serializePresetAccess('reactRefresh', presets.refresh.source)}.rules }`,
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
    return { imports: imports, blocks: output.join('') };
}

export { buildReactFragment };
