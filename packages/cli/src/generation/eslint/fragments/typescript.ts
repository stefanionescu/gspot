import { getPreset, buildArrayPresetBlocks } from '#cli/generation/eslint/presets.ts';
import type { EslintFragment, EslintFragmentContext } from '#cli/types/generation/eslint.ts';

import {
    FRAGMENT_IMPORTS,
    TYPESCRIPT_RULES,
    TYPESCRIPT_TEST_RULES_OFF,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply the typed presets and the project files.
 *
 * @param context the presets and file selectors of the scope.
 * @returns imported bindings and unscoped block data.
 */
function buildTypescriptFragment(
    context: Pick<EslintFragmentContext, 'presets' | 'eslintFiles' | 'projects'>,
): EslintFragment {
    const { presets, eslintFiles, projects } = context;
    const strict = getPreset(presets, 'strict');
    return {
        imports: FRAGMENT_IMPORTS.typescript,
        blocks: [
            ...buildArrayPresetBlocks(strict, 'tseslint', ({ parser, ...block }) => ({
                ...block,
                files: parser ? eslintFiles.typescriptSource : eslintFiles.typescript,
            })),
            {
                data: { files: eslintFiles.typescript, rules: TYPESCRIPT_RULES },
                properties: `plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: joinRoot(${JSON.stringify(projects)}) })] }`,
            },
            { data: { files: eslintFiles.tests, rules: TYPESCRIPT_TEST_RULES_OFF } },
        ],
    };
}

export { buildTypescriptFragment };
