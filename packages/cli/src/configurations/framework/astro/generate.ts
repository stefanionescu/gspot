import { ASTRO_RULE_OPTIONS, ASTRO_RULES, ASTRO_TYPED_RULES } from '#cli/config/configurations/framework.ts';
import { ASTRO_FILES, ASTRO_SCRIPT_FILES } from '#cli/config/configurations/shared.ts';
import { TYPESCRIPT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import {
    type ConfigurationBlocks,
    type EslintBlockBuilder,
    type EslintScope,
} from '#cli/types/configurations/javascript.ts';

function buildAstroBlocks(scope: Pick<EslintScope, 'settings'>): ConfigurationBlocks {
    const blocks: ConfigurationBlocks = [
        {
            fields: { files: [...ASTRO_FILES, ...ASTRO_SCRIPT_FILES] },
            presets: [{ package: 'eslint-plugin-astro', path: 'configs.flat/recommended', merge: 'fields' }],
        },
        {
            fields: { files: ASTRO_FILES, rules: ASTRO_RULES },
            presets: [{ package: 'eslint-plugin-astro', path: 'configs.flat/jsx-a11y-recommended', merge: 'rules' }],
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
                calls: [{ name: 'setScriptParser', args: [{ package: 'typescript-eslint', path: 'parser' }] }],
            },
            {
                fields: { files: ASTRO_SCRIPT_FILES },
                presets: [{ package: 'typescript-eslint', path: 'configs.disableTypeChecked', merge: 'fields' }],
            },
        );
    }
    return blocks;
}

export const ASTRO_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
    astro: buildAstroBlocks,
};
