import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply Vitest presets to the selected test files.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildVitestFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'testRuleNames'>,
): EslintFragment {
    const { eslintPresets, eslintModule, eslintFiles, testRuleNames } = context;

    const imports: string[] = ["import vitest from '@vitest/eslint-plugin';"];

    const output: string[] = ['\n'];
    const preset = (eslintPresets.get('vitest') as FragmentPresets).recommended;
    output.push(
        eslintModule.block(
            {
                files: eslintFiles.tests,
                rules: {
                    ...preset.blocks[0].rules,
                    ...Object.fromEntries(testRuleNames.map((name) => [`vitest/${name}`, 'error'])),
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
