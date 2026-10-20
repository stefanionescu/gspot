import { PLUGIN_LINT_RULE_FRAGMENTS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment } from '#cli/types/generation/eslint.ts';

/**
 * Build the declared plugin imports and lint rule blocks.
 *
 * @param context the ESLint inputs of the scope.
 * @param configuration the name with the pinned lint rule list.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildLintRuleFragment(context: EslintContext, configuration: string): EslintFragment {
    // Only the fragments in PLUGIN_LINT_RULE_FRAGMENTS reach this function.
    const declaration = PLUGIN_LINT_RULE_FRAGMENTS[configuration] as (typeof PLUGIN_LINT_RULE_FRAGMENTS)[string];
    return {
        imports: [...declaration.imports],
        blocks:
            context.blockWriter.block(
                {
                    files: declaration.files === 'code' ? context.eslintFiles.code : declaration.files,
                    ...(declaration.ignores === undefined ? {} : { ignores: context[declaration.ignores] }),
                    rules: declaration.rules,
                },
                declaration.plugins,
            ) + ',\n',
    };
}

export { buildLintRuleFragment };
