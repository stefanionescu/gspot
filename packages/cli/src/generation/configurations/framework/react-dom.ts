import { REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { REACT_FILES } from '#cli/config/generation/configurations/framework/nextjs.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { REACT_DOM_RULE_OPTIONS } from '#cli/config/generation/configurations/framework/react.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

/**
Apply the accessibility lint rules to the React DOM files.

@param scope the planned ESLint file of the scope.
*/
export function buildReactDomBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const blocks: ConfigurationBlocks['blocks'] = [];
    if (!scope.settings.configurations.includes(REACT_NATIVE_CONFIGURATION)) {
        blocks.push({
            fields: { files: REACT_FILES },
            presets: [{ importName: 'accessibility', path: 'configs.recommended', merge: 'rules' }],
            calls: [
                { name: 'addPlugins', args: [{ imports: { 'jsx-a11y-x': 'accessibility' } }] },
                { name: 'mergeRuleOptions', args: [{ value: REACT_DOM_RULE_OPTIONS }] },
            ],
        });
    }
    return {
        imports: CONFIGURATION_PLUGINS['react-dom'],
        blocks,
    };
}
