import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { TYPESCRIPT_RULES, TYPESCRIPT_TEST_RULES_OFF } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Write typescript ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.json the JSON writer for emitted options.
 * @param root0.eslint the resolved ESLint configuration reader.
 *
 * @returns the ESLint fragment source.
 */
export function buildTypescriptFragment({
    eslintPresets,
    eslintModule,
    eslintFiles,
    json,
    eslint,
}: Pick<EslintFragmentInputs, 'eslintPresets' | 'eslintModule' | 'eslintFiles' | 'json' | 'eslint'>): string {
    const output: string[] = [
        "import tseslint from 'typescript-eslint';\nimport { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';\n",
    ];
    const presets = eslintPresets('typescript') as FragmentPresets;
    for (const [index, { parser, ...block }] of presets.strict.blocks.entries()) {
        output.push(
            '\n',
            eslintModule.block(
                { ...block, files: parser ? eslintFiles.typescriptSource : eslintFiles.typescript },
                `...${serializePresetAccess('tseslint', presets.strict.source)}[${String(index)}]`,
                {
                    expression: `${serializePresetAccess('tseslint', presets.strict.source)}[${String(index)}].rules`,
                    rules: block.rules,
                },
            ),
            ',\n',
        );
    }
    const projects = eslint().projects;

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
    return output.join('');
}
