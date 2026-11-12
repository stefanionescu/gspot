import { DEFAULT_PROJECT_FILE_LIMIT, DEFAULT_PROJECT_LIMIT_OPTION } from '#cli/config/configurations/eslint/blocks.ts';
import { ASTRO_FILES, ASTRO_SCRIPT_FILES } from '#cli/config/configurations/framework.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES } from '#cli/config/configurations/typescript.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import {
    type ConfigurationBlocks,
    type EslintBlockBuilder,
    type EslintScope,
} from '#cli/types/configurations/javascript.ts';

const ASTRO_CONFIGURATION = 'astro';

function buildTypescriptBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'projects' | 'defaultProjectFiles' | 'settings'>,
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
    const blocks: ConfigurationBlocks = [
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
    // The Astro processor lints each script of a component as a virtual .ts file, which the typed blocks above match and
    // no project holds. Unless this block comes after them, typescript-eslint cannot parse the script, and the processor
    // drops that parse error, so the script goes unlinted.
    if (scope.settings.configurations.includes(ASTRO_CONFIGURATION))
        blocks.push({
            fields: { files: ASTRO_SCRIPT_FILES },
            presets: [{ package: 'typescript-eslint', path: 'configs.disableTypeChecked', merge: 'fields' }],
        });
    return blocks;
}

export const TYPESCRIPT_BLOCK_BUILDERS: Readonly<Record<string, EslintBlockBuilder>> = {
    typescript: buildTypescriptBlocks,
};
