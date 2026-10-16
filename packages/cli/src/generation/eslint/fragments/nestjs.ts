import { literalGlob } from '#cli/repository/matchers.ts';
import { presetSource } from '#cli/generation/eslint/serialize.ts';
import type { FragmentPresets, EslintFragmentInputs } from '#cli/types/generation/eslint.ts';
import { NESTJS_ALL_LEVEL_RULES, NESTJS_INJECTABLE_FILTER_PATHS } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Write nestjs ESLint rules for the selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.eslintModule the ESLint block writer.
 * @param root0.eslintFiles the code and test file selectors.
 * @param root0.eslintPresets the declared ESLint preset reader.
 * @param root0.scope the selected project scope.
 * @param root0.scopeDependencies the dependency names in this scope.
 *
 * @returns the ESLint fragment source.
 */
export function nestjsFragment({
    eslintModule,
    eslintFiles,
    eslintPresets,
    scope,
    scopeDependencies,
}: Pick<
    EslintFragmentInputs,
    'eslintModule' | 'eslintFiles' | 'eslintPresets' | 'scope' | 'scopeDependencies'
>): string {
    const output: string[] = ["import nestjsTyped from '@darraghor/eslint-plugin-nestjs-typed';\n"];
    const presets = eslintPresets('nestjs') as FragmentPresets;
    output.push(
        '\n',
        eslintModule.block({
            files: eslintFiles.typescript,
            rules: NESTJS_ALL_LEVEL_RULES,
        }),
        ',\n',
    );
    const selected = [
        presets.recommended,
        ...(scopeDependencies.includes('@nestjs/swagger') ? [] : [presets.noSwagger]),
    ];
    const rules = Object.fromEntries(
        selected.flatMap((preset) =>
            preset.blocks.flatMap((block) => (block.rules === undefined ? [] : Object.entries(block.rules))),
        ),
    );
    const sources = selected
        .map((preset) => `...${presetSource('nestjsTyped', preset.source)}.map((block) => block.rules)`)
        .join(', ');
    const prefix = scope === '' ? '' : `${literalGlob(scope)}/`;
    output.push(
        '\n',
        eslintModule.block(
            {
                files: eslintFiles.typescriptSource,
                rules: {
                    ...rules,
                    '@darraghor/nestjs-typed/injectable-should-be-provided': [
                        'error',
                        {
                            src: [`${prefix}**/*.ts`],
                            filterFromPaths: NESTJS_INJECTABLE_FILTER_PATHS,
                        },
                    ],
                },
            },
            "plugins: { '@darraghor/nestjs-typed': nestjsTyped.plugin }",
            {
                expression: `Object.assign({}, ${sources})`,
                rules,
            },
        ),
        ',\n',
    );
    return output.join('');
}
