import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import type { EslintScope, ConfigurationBlocks } from '#cli/types/configurations/language.ts';

import {
    TS_PATTERN,
    NESTJS_RULES,
    SWAGGER_PACKAGE,
    NESTJS_INJECTABLE_FILTER_PATHS,
} from '#cli/config/configurations/framework.ts';

/**
Apply the NestJS presets, and the no-Swagger preset when the scope does not use @nestjs/swagger, to the TypeScript
files.

@param scope the planned ESLint file of the scope.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: CONFIGURATION_BUILDERS calls it by configuration name, like every block builder.
export function buildNestjsBlocks(
    scope: Pick<EslintScope, 'eslintFiles' | 'path' | 'dependencies'>,
): ConfigurationBlocks {
    const { eslintFiles, path: scopePath, dependencies: scopeDependencies } = scope;
    return [
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
                {
                    name: 'addPlugins',
                    args: [{ plugins: [{ package: '@darraghor/eslint-plugin-nestjs-typed', path: 'plugin' }] }],
                },
            ],
            presets: [
                { package: '@darraghor/eslint-plugin-nestjs-typed', path: 'configs.flatRecommended', merge: 'rules' },
                ...(scopeDependencies.includes(SWAGGER_PACKAGE)
                    ? []
                    : [
                          {
                              package: '@darraghor/eslint-plugin-nestjs-typed',
                              path: 'configs.flatNoSwagger',
                              merge: 'rules',
                          } as const,
                      ]),
            ],
        },
    ];
}
