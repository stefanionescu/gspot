import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type EslintScope, type ConfigurationBlocks } from '#cli/types/generation/eslint.ts';
import { CONFIGURATION_PLUGINS } from '#cli/config/generation/configurations/language/javascript/eslint/configuration-blocks.ts';

import {
    TS_PATTERN,
    NESTJS_RULES,
    SWAGGER_PACKAGE,
    NESTJS_INJECTABLE_FILTER_PATHS,
} from '#cli/config/generation/configurations/framework/nestjs.ts';

/**
Apply the NestJS presets, and the no-Swagger preset when the scope does not use @nestjs/swagger, to the TypeScript
files.

@param scope the planned ESLint file of the scope.
*/
export function buildNestjsBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'path' | 'dependencies'>,
): ConfigurationBlocks {
    const { eslintFiles, path: scopePath, dependencies: scopeDependencies } = scope;
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
                    '@darraghor/nestjs-typed/injectable-should-be-provided': [
                        'error',
                        {
                            src: [joinScope(escapeGlob(scopePath), TS_PATTERN)],
                            filterFromPaths: NESTJS_INJECTABLE_FILTER_PATHS,
                        },
                    ],
                },
            },
            calls: [
                { name: 'addPlugins', args: [{ imports: { '@darraghor/nestjs-typed': ['nestjsTyped', 'plugin'] } }] },
            ],
            presets: [
                { importName: 'nestjsTyped', path: 'configs.flatRecommended', merge: 'rules' },
                ...(scopeDependencies.includes(SWAGGER_PACKAGE)
                    ? []
                    : [{ importName: 'nestjsTyped', path: 'configs.flatNoSwagger', merge: 'rules' } as const]),
            ],
        },
    ];
    return {
        imports: CONFIGURATION_PLUGINS.nestjs,
        blocks,
    };
}
