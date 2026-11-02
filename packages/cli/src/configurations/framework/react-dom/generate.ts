import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

import {
    REACT_FILES,
    REACT_DOM_RULE_OPTIONS,
    REACT_NATIVE_CONFIGURATION,
} from '#cli/config/configurations/framework.ts';

/**
Apply the accessibility lint rules to the React DOM files.

@param scope the planned ESLint file of the scope.
*/
export function buildReactDomBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const blocks: ConfigurationBlocks = [];
    if (!scope.settings.configurations.includes(REACT_NATIVE_CONFIGURATION)) {
        blocks.push({
            fields: { files: REACT_FILES },
            presets: [{ package: 'eslint-plugin-jsx-a11y-x', path: 'configs.recommended', merge: 'rules' }],
            calls: [
                { name: 'addPlugins', args: [{ plugins: ['eslint-plugin-jsx-a11y-x'] }] },
                { name: 'mergeRuleOptions', args: [{ value: REACT_DOM_RULE_OPTIONS }] },
            ],
        });
    }
    return blocks;
}
