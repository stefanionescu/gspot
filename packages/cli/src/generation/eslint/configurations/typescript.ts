import { getPreset, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/generation/eslint.ts';

import {
    TYPESCRIPT_RULES,
    CONFIGURATION_PLUGINS,
    TYPESCRIPT_TEST_RULES,
} from '#cli/config/generation/eslint/configurations.ts';

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
                data: { files: eslintFiles.typed, rules: TYPESCRIPT_RULES },
                properties: `plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: joinRoot(${JSON.stringify(projects)}) })] }`,
            },
            { data: { files: eslintFiles.tests, rules: TYPESCRIPT_TEST_RULES } },
        ],
    };
}
