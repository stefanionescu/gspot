import { serializeBlocks } from '#cli/generation/eslint/print.ts';
import { buildPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { convertWarningsToErrors } from '#cli/generation/eslint/block-writer.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply the TanStack Query presets, with enabled warnings turned into errors.
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildTanstackQueryFragment(
    context: Pick<EslintContext, 'blockWriter' | 'eslintFiles' | 'eslintPresets'>,
): EslintFragment {
    const { blockWriter, eslintFiles, eslintPresets } = context;

    const imports: string[] = ["import tanstackQuery from '@tanstack/eslint-plugin-query';"];

    const output: string[] = ['\n'];
    const preset = (eslintPresets.get('tanstack-query') as FragmentPresets).recommended;
    output.push(
        serializeBlocks(
            blockWriter,
            buildPresetBlocks(preset, 'tanstackQuery', ({ rules }, index, source) => [
                { files: eslintFiles.code, ...(rules === undefined ? {} : { rules: convertWarningsToErrors(rules) }) },
                "plugins: { '@tanstack/query': tanstackQuery }",
                { expression: `${source}[${String(index)}].rules`, rules },
            ]),
        ),
        '\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildTanstackQueryFragment };
