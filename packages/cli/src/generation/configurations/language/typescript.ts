import { ASTRO_FILES } from '#cli/config/generation/configurations/framework.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/eslint.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES } from '#cli/config/generation/configurations/language/language.ts';

/**
Apply the parser of typescript-eslint to TypeScript files, its strict typed rules to every typed file, and the
project files.

@param scope the file selectors and projects of the scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The configuration builder table or shared block builders call this function.
export function buildTypescriptBlocks(scope: Pick<EslintScope, 'eslintFiles' | 'projects'>): ConfigurationBlocks {
    const { eslintFiles, projects } = scope;
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
                    languageOptions: { parserOptions: { projectService: true } },
                },
            },
            { fields: { files: eslintFiles.tests, rules: TYPESCRIPT_TEST_RULES } },
        ],
    };
}
