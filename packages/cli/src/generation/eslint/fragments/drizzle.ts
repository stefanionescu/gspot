import { DRIZZLE_RULES } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';

/**
 * Require safe changes in Drizzle queries.
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildDrizzleFragment(
    context: Pick<EslintContext, 'blockWriter' | 'eslintFiles' | 'settings'>,
): EslintFragment {
    const { blockWriter, eslintFiles, settings } = context;

    const imports: string[] = ["import drizzlePlugin from 'eslint-plugin-drizzle';"];

    const output: string[] = ['\n'];
    const rule = ['error', { drizzleObjectName: settings['drizzle.client_names'] }];
    output.push(
        '\n',
        blockWriter.block(
            {
                files: eslintFiles.code,
                rules: Object.fromEntries(DRIZZLE_RULES.map((name) => [name, rule])),
            },
            'plugins: { drizzle: drizzlePlugin }',
        ),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildDrizzleFragment };
