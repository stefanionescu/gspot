import { DEFAULT_PROJECT_FILE_LIMIT, DEFAULT_PROJECT_LIMIT_OPTION } from '#cli/config/configurations/blocks.ts';
import { ASTRO_FILES } from '#cli/config/configurations/framework.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES } from '#cli/config/configurations/language.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers.ts';
import {
    type ConfigurationBlocks,
    type ConfigurationBuilder,
    type EslintScope,
} from '#cli/types/configurations/language.ts';

function buildTypescriptBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'projects' | 'defaultProjectFiles'>,
): ConfigurationBlocks {
    const { eslintFiles, projects, defaultProjectFiles } = scope;
    const projectService =
        defaultProjectFiles.length === 0
            ? true
            : {
                  allowDefaultProject: defaultProjectFiles,
                  ...(projects.includes(TSCONFIG_FILE) && { defaultProject: TSCONFIG_FILE }),
                  ...(defaultProjectFiles.length > DEFAULT_PROJECT_FILE_LIMIT && {
                      [DEFAULT_PROJECT_LIMIT_OPTION]: defaultProjectFiles.length,
                  }),
              };
    return [
        {
            fields: { files: eslintFiles.typescript },
            presets: [{ package: 'typescript-eslint', path: 'configs.base', merge: 'fields' }],
        },
        {
            fields: { files: eslintFiles.typed },
            presets: [{ package: 'typescript-eslint', path: 'configs.strictTypeChecked', merge: 'rules' }],
        },
        {
            fields: {
                files: eslintFiles.typed,
                rules: TYPESCRIPT_RULES,
                settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] } },
            },
            calls: [
                { name: 'addPlugins', args: [{ plugins: [{ package: 'typescript-eslint', path: 'plugin' }] }] },
                {
                    name: 'setRootFolder',
                    args: [{ value: [['languageOptions', 'parserOptions', 'tsconfigRootDir']] }],
                },
                {
                    name: 'setImportLookup',
                    args: [{ package: 'eslint-import-resolver-typescript' }, { value: projects }],
                },
            ],
        },
        {
            fields: {
                files: eslintFiles.typed,
                ignores: [...ASTRO_FILES],
                languageOptions: { parserOptions: { projectService } },
            },
        },
        { fields: { files: eslintFiles.tests, rules: TYPESCRIPT_TEST_RULES } },
    ];
}

export const TYPESCRIPT_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    typescript: buildTypescriptBlocks,
};
