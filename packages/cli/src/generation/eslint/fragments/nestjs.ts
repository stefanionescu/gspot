import { escapeGlob } from '#cli/repository/matchers.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';
import { NESTJS_ALL_LEVEL_RULES, NESTJS_INJECTABLE_FILTER_PATHS } from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply NestJS rules and the selected TypeScript parsing mode.
 * @param context the selected presets, rule printer, and scope settings.
 * @returns the imports and ESLint blocks for this configuration.
 */
export function buildNestjsFragment(
    context: Pick<EslintContext, 'eslintModule' | 'eslintFiles' | 'eslintPresets' | 'scope' | 'scopeDependencies'>,
): EslintFragment {
    const { eslintModule, eslintFiles, eslintPresets, scope, scopeDependencies } = context;

    const imports: string[] = ["import nestjsTyped from '@darraghor/eslint-plugin-nestjs-typed';"];

    const output: string[] = ['\n'];
    const presets = eslintPresets.get('nestjs') as FragmentPresets;
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
        .map((preset) => `...${serializePresetAccess('nestjsTyped', preset.source)}.map((block) => block.rules)`)
        .join(', ');
    const prefix = scope === '' ? '' : `${escapeGlob(scope)}/`;
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
    return { imports: imports, blocks: output.join('') };
}
