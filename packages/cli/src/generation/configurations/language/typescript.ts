import { ASTRO_FILES } from '#cli/config/generation/configurations/framework/astro.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES } from '#cli/config/generation/configurations/language/typescript.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    getPreset,
    buildArrayPresetBlocks,
} from '#cli/generation/configurations/language/javascript/eslint/presets.ts';

/**
 * Apply the typed presets and the project files.
 *
 * @param scope the presets and file selectors of the scope.
 * @returns imported bindings and unscoped block data.
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
                fields: { files: eslintFiles.typed, rules: TYPESCRIPT_RULES },
                properties: `plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: [${projects.map((project) => 'join(root, ' + JSON.stringify(project) + ')').join(', ')}] })] }`,
            },
            {
                fields: { files: eslintFiles.typed, ignores: [...ASTRO_FILES] },
                properties: 'languageOptions: { parserOptions: { projectService: true } }',
            },
            { fields: { files: eslintFiles.tests, rules: TYPESCRIPT_TEST_RULES } },
        ],
    };
}
