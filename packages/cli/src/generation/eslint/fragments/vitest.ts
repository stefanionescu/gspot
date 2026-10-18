import { TEST_RULE_NAMES } from '#cli/config/generation/eslint.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply the Vitest presets to the test files.
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildVitestFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'eslintFiles'>,
): EslintFragment {
    const { eslintPresets, blockWriter, eslintFiles } = context;

    const imports: string[] = ["import vitest from '@vitest/eslint-plugin';"];

    const output: string[] = ['\n'];
    const preset = (eslintPresets.get('vitest') as FragmentPresets).recommended;
    output.push(
        blockWriter.block(
            {
                files: eslintFiles.tests,
                rules: {
                    ...preset.blocks[0].rules,
                    ...Object.fromEntries(TEST_RULE_NAMES.map((name) => [`vitest/${name}`, 'error'])),
                    'vitest/no-focused-tests': ['error', { fixable: false }],
                },
            },
            'plugins: { vitest }',
            { expression: `${serializePresetAccess('vitest', preset.source)}.rules`, rules: preset.blocks[0].rules },
        ),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildVitestFragment };
