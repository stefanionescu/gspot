import { getPreset } from '#cli/generation/eslint/presets.ts';
import { buildScopeGlob } from '#cli/generation/eslint/files.ts';
import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { type EslintFragment, type EslintFragmentContext } from '#cli/types/generation/eslint.ts';

import {
    NESTJS_RULES,
    FRAGMENT_IMPORTS,
    NESTJS_INJECTABLE_FILTER_PATHS,
} from '#cli/config/generation/eslint-fragments.ts';

/**
 * Apply the NestJS lint rules and the TypeScript parsing mode of the scope.
 *
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildNestjsFragment(
    context: Pick<EslintFragmentContext, 'eslintFiles' | 'presets' | 'scope' | 'scopeDependencies'>,
): EslintFragment {
    const { eslintFiles, presets, scope, scopeDependencies } = context;
    const recommended = getPreset(presets, 'recommended');
    const noSwagger = getPreset(presets, 'noSwagger');
    const blocks: EslintFragment['blocks'] = [
        {
            data: {
                files: eslintFiles.typescript,
                rules: NESTJS_RULES,
            },
        },
    ];
    const selected = [recommended, ...(scopeDependencies.includes('@nestjs/swagger') ? [] : [noSwagger])];
    const rules = Object.fromEntries(
        selected.flatMap((preset) =>
            preset.blocks.flatMap((block) => (block.rules === undefined ? [] : Object.entries(block.rules))),
        ),
    );
    const sources = selected.map((preset) => `...${serializePresetAccess('nestjsTyped', preset.source)}`).join(', ');
    blocks.push({
        data: {
            files: eslintFiles.typescriptSource,
            rules: {
                ...rules,
                '@darraghor/nestjs-typed/injectable-should-be-provided': [
                    'error',
                    {
                        src: [buildScopeGlob(scope, '**/*.ts')],
                        filterFromPaths: NESTJS_INJECTABLE_FILTER_PATHS,
                    },
                ],
            },
        },
        properties: "plugins: { '@darraghor/nestjs-typed': nestjsTyped.plugin }",
        preset: {
            expression: `mergePresetRules([${sources}])`,
            rules,
        },
    });
    return {
        imports: FRAGMENT_IMPORTS['nestjs'],
        blocks,
    };
}
export { buildNestjsFragment };
