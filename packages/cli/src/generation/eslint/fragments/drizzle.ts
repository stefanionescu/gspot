import { DRIZZLE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import type { EslintFragmentInputs } from '#cli/types/generation/eslint.ts';

/**
 * Write drizzle ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.settings the validated settings.
 *
 * @returns the ESLint fragment source.
 */
export function drizzleFragment({
    eslintModule,
    eslintFiles,
    settings,
}: Pick<EslintFragmentInputs, 'eslintModule' | 'eslintFiles' | 'settings'>): string {
    const output: string[] = ["import drizzlePlugin from 'eslint-plugin-drizzle';\n"];
    const rule = ['error', { drizzleObjectName: settings['drizzle.client_names'] }];
    output.push(
        '\n',
        eslintModule.block(
            {
                files: eslintFiles.code,
                rules: Object.fromEntries(DRIZZLE_RULES.map((name) => [name, rule])),
            },
            'plugins: { drizzle: drizzlePlugin }',
        ),
        ',\n',
    );
    return output.join('');
}
