import { JSON_INDENT } from '#cli/config/text.ts';
import { getLimit } from '#cli/settings/scopes.ts';
import type { PlannedConfig } from '#cli/types/generation/files.ts';
import { BIOME_TYPESCRIPT_FILES } from '#cli/config/configurations/generators/language/javascript/javascript.ts';

/**
Keep Biome limited to cognitive complexity, with the scope's language thresholds.

@param planned the config file and the scope it checks.
*/
export function buildBiomeFile(planned: PlannedConfig): string {
    const javascript = getLimit(planned.scope.settings, 'cognitive_complexity', 'javascript');
    const typescript = getLimit(planned.scope.settings, 'cognitive_complexity', 'typescript');
    const rules = {
        preset: 'none',
        complexity: {
            noExcessiveCognitiveComplexity: {
                level: 'error',
                options: { maxAllowedComplexity: javascript },
            },
        },
    };
    return JSON.stringify(
        {
            root: true,
            html: { experimentalFullSupportEnabled: true },
            vcs: { enabled: false },
            formatter: { enabled: false },
            assist: { enabled: false },
            linter: { rules },
            overrides: [
                {
                    includes: BIOME_TYPESCRIPT_FILES,
                    linter: {
                        rules: {
                            complexity: {
                                noExcessiveCognitiveComplexity: {
                                    level: 'error',
                                    options: { maxAllowedComplexity: typescript },
                                },
                            },
                        },
                    },
                },
            ],
        },
        null,
        JSON_INDENT,
    );
}
