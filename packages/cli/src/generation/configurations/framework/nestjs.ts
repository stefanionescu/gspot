import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { getPreset } from '#cli/generation/configurations/language/javascript/eslint/presets.ts';
import { buildScopeGlob } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { serializePresetAccess } from '#cli/generation/configurations/language/javascript/eslint/print.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    NESTJS_RULES,
    NESTJS_INJECTABLE_FILTER_PATHS,
} from '#cli/config/generation/configurations/framework/nestjs.ts';

/**
Apply the NestJS presets to the TypeScript files of the scope, with the no-Swagger preset when the scope does not use
@nestjs/swagger.

@param scope the planned ESLint file of the scope.
@returns the imports and ESLint blocks for this configuration.
*/
export function buildNestjsBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'presets' | 'scopePath' | 'scopeDependencies'>,
): ConfigurationBlocks {
    const { eslintFiles, presets, scopePath, scopeDependencies } = scope;
    const recommended = getPreset(presets, 'recommended');
    const noSwagger = getPreset(presets, 'noSwagger');
    const selected = [recommended, ...(scopeDependencies.includes('@nestjs/swagger') ? [] : [noSwagger])];
    const rules = Object.fromEntries(
        selected.flatMap((preset) =>
            preset.blocks.flatMap((block) => (block.rules === undefined ? [] : Object.entries(block.rules))),
        ),
    );
    const sources = selected.map((preset) => `...${serializePresetAccess('nestjsTyped', preset.source)}`).join(', ');
    const blocks: ConfigurationBlocks['blocks'] = [
        {
            fields: {
                files: eslintFiles.typed,
                rules: NESTJS_RULES,
            },
        },

        {
            fields: {
                files: eslintFiles.typescript,
                rules: {
                    ...rules,
                    '@darraghor/nestjs-typed/injectable-should-be-provided': [
                        'error',
                        {
                            src: [buildScopeGlob(scopePath, '**/*.ts')],
                            filterFromPaths: NESTJS_INJECTABLE_FILTER_PATHS,
                        },
                    ],
                },
            },
            properties: "plugins: { '@darraghor/nestjs-typed': nestjsTyped.plugin }",
            preset: {
                expression: `Object.assign({}, ...[${sources}].map((block) => block.rules))`,
                rules,
            },
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.nestjs,
        blocks,
    };
}
