import {
    REACT_DOM_RULE_OPTIONS,
    REACT_FILES,
    REACT_NATIVE_CONFIGURATION,
} from '#cli/config/configurations/framework.ts';
import {
    type ConfigurationBlocks,
    type EslintBlockBuilder,
    type EslintScope,
} from '#cli/types/configurations/javascript.ts';

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

export const REACT_DOM_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
    'react-dom': buildReactDomBlocks,
};
