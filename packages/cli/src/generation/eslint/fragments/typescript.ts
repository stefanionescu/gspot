import { serializeBlocks } from '#cli/generation/eslint/print.ts';
import { buildPresetBlocks } from '#cli/generation/eslint/presets.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES_OFF } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Apply typed presets and the selected project files.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildTypescriptFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'json' | 'eslint'>,
): EslintFragment {
    const { eslintPresets, eslintModule, eslintFiles, json, eslint } = context;

    const imports: string[] = [
        "import tseslint from 'typescript-eslint';",
        "import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';",
    ];

    const output: string[] = ['\n\n'];
    const presets = eslintPresets.get('typescript') as FragmentPresets;
    output.push(
        serializeBlocks(
            eslintModule,
            buildPresetBlocks(presets.strict, 'tseslint', ({ parser, ...block }, index, source) => [
                { ...block, files: parser ? eslintFiles.typescriptSource : eslintFiles.typescript },
                `...${source}[${String(index)}]`,
                {
                    expression: `${source}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ]),
        ),
    );
    const projects = eslint.projects;

    output.push(
        '\n',
        eslintModule.block(
            { files: eslintFiles.typescript, rules: TYPESCRIPT_RULES },
            `plugins: { '@typescript-eslint': tseslint.plugin }, languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: root } }, settings: { 'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts'] }, 'import-x/resolver-next': [createTypeScriptImportResolver({ project: ${json(projects)}.map((project) => join(root, project)) })] }`,
        ),
        ',\n',
        eslintModule.block({
            files: eslintFiles.tests,
            rules: TYPESCRIPT_TEST_RULES_OFF,
        }),
        ',\n',
    );
    return { imports: imports, blocks: output.join('') };
}

export { buildTypescriptFragment };
