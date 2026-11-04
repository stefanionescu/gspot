import {
    REACT_FILES,
    REACT_DOM_RULE_OPTIONS,
    REACT_NATIVE_CONFIGURATION,
} from '#cli/config/configurations/framework.ts';
import {
    type EslintScope,
    type ConfigurationBlocks,
    type ConfigurationBuilder,
} from '#cli/types/configurations/language.ts';

/**
Apply the accessibility lint rules to the React DOM files.

@param scope the planned ESLint file of the scope.
*/
function buildReactDomBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
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

export const REACT_DOM_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    'react-dom': buildReactDomBlocks,
};
