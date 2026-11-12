import { BIOME_TYPESCRIPT_FILES } from '#cli/config/configurations/javascript.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { getLimit } from '#cli/settings/scopes.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildComplexityRules(planned: PlannedConfig, language: 'javascript' | 'typescript') {
    const limit = getLimit(planned.scope.settings, 'max_cognitive_complexity', language);
    return {
        complexity: { noExcessiveCognitiveComplexity: { level: 'error', options: { maxAllowedComplexity: limit } } },
    };
}

export const BIOME_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'javascript/biome.json': (planned) =>
        JSON.stringify(
            {
                root: true,
                html: { experimentalFullSupportEnabled: true },
                vcs: { enabled: false },
                formatter: { enabled: false },
                assist: { enabled: false },
                linter: { rules: { preset: 'none', ...buildComplexityRules(planned, 'javascript') } },
                overrides: [
                    {
                        includes: BIOME_TYPESCRIPT_FILES,
                        linter: { rules: buildComplexityRules(planned, 'typescript') },
                    },
                ],
            },
            null,
            JSON_INDENT,
        ),
};
