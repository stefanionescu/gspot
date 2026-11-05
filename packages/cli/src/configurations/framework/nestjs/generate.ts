import {
    NESTJS_INJECTABLE_FILTER_PATHS,
    NESTJS_RULES,
    SWAGGER_PACKAGE,
    TS_PATTERN,
} from '#cli/config/configurations/framework.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { type ConfigurationBuilder } from '#cli/types/configurations/language.ts';

export const NESTJS_BLOCK_BUILDERS: Readonly<Record<string, ConfigurationBuilder>> = {
    nestjs: (scope) => {
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
                    {
                        package: '@darraghor/eslint-plugin-nestjs-typed',
                        path: 'configs.flatRecommended',
                        merge: 'rules',
                    },
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
    },
};
