import { ASTRO_FILES } from '#cli/config/generation/configurations/framework/astro.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES } from '#cli/config/generation/configurations/language/typescript.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildArrayPresetBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
Apply the typed presets and the project files.

@param scope the presets and file selectors of the scope.
*/
export function buildTypescriptBlocks(
    scope: Pick<EslintScope, 'presets' | 'eslintFiles' | 'projects'>,
): ConfigurationBlocks {
    const { presets, eslintFiles, projects } = scope;
    const strict = getPreset(presets, 'strict');
    return {
        imports: CONFIGURATION_PLUGINS.typescript,
        blocks: [
            ...buildArrayPresetBlocks(strict, 'tseslint', ({ parser, ...block }) => ({
                ...block,
                files: parser ? eslintFiles.typescript : eslintFiles.typed,
            })),
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
