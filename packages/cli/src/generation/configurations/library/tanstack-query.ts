import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildArrayPresetBlocks,
    convertWarningsToErrors,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the TanStack Query presets with enabled warnings raised to errors.

@param scope the preset exports and code selectors.
*/
export function buildTanstackQueryBlocks(scope: Pick<EslintScope, 'presets' | 'eslintFiles'>): ConfigurationBlocks {
    const { presets, eslintFiles } = scope;
    const recommended = getPreset(presets, 'recommended');
    return {
        imports: CONFIGURATION_PLUGINS['tanstack-query'],
        blocks: buildArrayPresetBlocks(recommended, 'tanstackQuery', ({ rules }) => ({
            files: eslintFiles.code,
            ...(rules !== undefined && { rules: convertWarningsToErrors(rules) }),
        })),
    };
}
