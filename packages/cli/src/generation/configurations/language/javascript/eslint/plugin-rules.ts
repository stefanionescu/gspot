import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { PLUGIN_RULE_BLOCKS } from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

/**
Build the declared plugin imports and lint rule blocks.

@param scope the planned ESLint file of the scope.
@param configuration the name with the pinned lint rule list.
*/
export function buildPluginRuleBlocks(scope: EslintScope, configuration: string): ConfigurationBlocks {
    const declaration = PLUGIN_RULE_BLOCKS[configuration] as (typeof PLUGIN_RULE_BLOCKS)[string];
    const selectors = { code: scope.eslintFiles.code, tests: scope.eslintFiles.tests };
    const files = typeof declaration.files === 'string' ? selectors[declaration.files] : declaration.files;
    return {
        imports: declaration.imports,
        blocks: [
            {
                fields: {
                    ...declaration.fields,
                    files,
                    ...(declaration.ignoresTests === true && {
                        ignores: [
                            ...new Set(
                                scope.eslintFiles.tests.map(([test]) => test).filter((test) => test !== undefined),
                            ),
                        ],
                    }),
                    rules: declaration.rules,
                },
                calls: declaration.calls,
            },
        ],
    };
}
