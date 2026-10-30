import { TYPESCRIPT_CONFIGURATION } from '#cli/config/manifests/names.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';

import {
    ASTRO_RULES,
    ASTRO_FILES,
    ASTRO_TYPED_RULES,
    ASTRO_RULE_OPTIONS,
    ASTRO_SCRIPT_FILES,
} from '#cli/config/generation/configurations/framework.ts';

/**
Apply Astro's presets and its component parser.

@param scope the selected configurations.
*/
export function buildAstroBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: { files: ASTRO_FILES },
            presets: [{ importName: 'astroPlugin', path: 'configs.flat/recommended', merge: 'spread' }],
        },
        {
            fields: { files: ASTRO_FILES, rules: ASTRO_RULES },
            presets: [{ importName: 'astroPlugin', path: 'configs.flat/jsx-a11y-recommended', merge: 'rules' }],
            calls: [
                { name: 'mergeRuleOptions', args: [{ value: ASTRO_RULE_OPTIONS }] },
                {
                    name: 'setRootFolder',
                    args: [{ value: [['languageOptions', 'parserOptions', 'tsconfigRootDir']] }],
                },
            ],
        },
    ];
    if (scope.settings.configurations.includes(TYPESCRIPT_CONFIGURATION)) {
        blocks.push(
            {
                fields: {
                    files: ASTRO_FILES,
                    rules: ASTRO_TYPED_RULES,
                    processor: 'astro/client-side-ts',
                    languageOptions: {
                        parserOptions: { project: true, projectService: false, extraFileExtensions: ['.astro'] },
                    },
                },
                calls: [{ name: 'setScriptParser', args: [{ importName: 'tseslint', path: 'parser' }] }],
            },
            {
                fields: { files: ASTRO_SCRIPT_FILES },
                presets: [{ importName: 'tseslint', path: 'configs.disableTypeChecked', merge: 'fields' }],
            },
        );
    }
    return { imports: CONFIGURATION_PLUGINS.astro, blocks };
}
