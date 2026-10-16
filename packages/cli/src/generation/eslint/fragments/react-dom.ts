import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { JSX_CODE_FILES } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply accessibility rules to the selected React DOM files.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildReactDomFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'configurations'>,
): EslintFragment {
    const { eslintPresets, blockWriter, configurations } = context;

    const imports: string[] = ["import accessibility from 'eslint-plugin-jsx-a11y';"];

    const output: string[] = ['\n'];
    if (!configurations.includes('react-native')) {
        const preset = (eslintPresets.get('react-dom') as FragmentPresets).accessibility;
        output.push(
            '\n',
            blockWriter.block(
                {
                    files: JSX_CODE_FILES,
                    ...(preset.blocks[0].rules === undefined ? {} : { rules: preset.blocks[0].rules }),
                },
                "plugins: { 'jsx-a11y': accessibility }",
                {
                    expression: `${serializePresetAccess('accessibility', preset.source)}.rules`,
                    rules: preset.blocks[0].rules,
                },
            ),
            ',\n',
        );
    }
    output.push('\n');
    return { imports: imports, blocks: output.join('') };
}

export { buildReactDomFragment };
