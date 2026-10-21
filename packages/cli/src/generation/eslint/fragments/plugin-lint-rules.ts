import { PLUGIN_LINT_RULE_FRAGMENTS } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';

/**
 * Build the declared plugin imports and lint rule blocks.
 *
 * @param context the ESLint inputs of the scope.
 * @param configuration the name with the pinned lint rule list.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildLintRuleFragment(context: EslintFragmentContext, configuration: string): EslintFragment {
    // Only the fragments in PLUGIN_LINT_RULE_FRAGMENTS reach this function.
    const declaration = PLUGIN_LINT_RULE_FRAGMENTS[configuration] as (typeof PLUGIN_LINT_RULE_FRAGMENTS)[string];
    const selectors = { code: context.eslintFiles.code, tests: context.eslintFiles.tests };
    const files = typeof declaration.files === 'string' ? selectors[declaration.files] : declaration.files;
    return {
        imports: declaration.imports,
        blocks: [
            {
                data: {
                    files,
                    ...(declaration.ignores === undefined
                        ? {}
                        : {
                              ignores: [
                                  ...new Set(
                                      context.eslintFiles.tests
                                          .map(([test]) => test)
                                          .filter((test) => test !== undefined),
                                  ),
                              ],
                          }),
                    rules: declaration.rules,
                },
                properties: declaration.properties,
            },
        ],
    };
}

export { buildLintRuleFragment };
