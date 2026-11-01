import { TSCONFIG_FILE } from '#cli/config/parsers.ts';
import { ASTRO_FILES, CONFIGURATION_PLUGINS } from '#cli/config/configurations/framework.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES } from '#cli/config/configurations/language.ts';
import { DEFAULT_PROJECT_FILE_LIMIT, DEFAULT_PROJECT_LIMIT_OPTION } from '#cli/config/configurations/blocks.ts';

/**
Apply the parser of typescript-eslint to TypeScript files, its strict typed rules to every typed file, and the
project files.

@param scope the file selectors and projects of the scope.
*/
export function buildTypescriptBlocks(
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
    return {
        imports: CONFIGURATION_PLUGINS.typescript,
        blocks: [
            {
                fields: { files: eslintFiles.typescript },
                presets: [{ importName: 'tseslint', path: 'configs.base', merge: 'fields' }],
            },
            {
                fields: { files: eslintFiles.typed },
                presets: [{ importName: 'tseslint', path: 'configs.strictTypeChecked', merge: 'rules' }],
            },
            {
                fields: {
                    files: eslintFiles.typed,
                    rules: TYPESCRIPT_RULES,
                    settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] } },
                },
                calls: [
                    { name: 'addPlugins', args: [{ imports: { '@typescript-eslint': ['tseslint', 'plugin'] } }] },
                    {
                        name: 'setRootFolder',
                        args: [{ value: [['languageOptions', 'parserOptions', 'tsconfigRootDir']] }],
                    },
                    {
                        name: 'setImportLookup',
                        args: [{ importName: 'createTypeScriptImportResolver' }, { value: projects }],
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
        ],
    };
}
