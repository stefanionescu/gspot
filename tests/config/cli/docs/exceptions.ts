import type { RuntimeSchemaCase } from '#tests/types/cli/docs/schema.ts';

/** Saved exceptions use the same accepted shapes at the root and in a project scope. */
export const EXCEPTION_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'reasoned formatter exclusions',
        input: {
            tools: {
                prettier: {
                    exclude: {
                        value: ['generated/**'],
                        reason: 'Reviewed generated output.',
                    },
                },
            },
        },
        valid: true,
    },
    {
        name: 'invalid formatter exclusion list',
        input: {
            tools: {
                prettier: {
                    exclude: {
                        value: false,
                        reason: 'Reviewed generated output.',
                    },
                },
            },
        },
        valid: false,
        diagnostic: 'gspot.toml: tools.prettier.exclude:',
    },
    {
        name: 'reasoned registry hosts',
        input: {
            dependencies: {
                registry_hosts: {
                    value: ['registry.example.test'],
                    reason: 'Reviewed package registry.',
                },
            },
        },
        valid: true,
    },
    {
        name: 'invalid registry host',
        input: {
            dependencies: {
                registry_hosts: [false],
            },
        },
        valid: false,
        diagnostic: 'gspot.toml: dependencies.registry_hosts:',
    },
    {
        name: 'reasoned manifest range allowance',
        input: {
            dependencies: {
                ranges_allowed: [
                    {
                        paths: ['packages/library/package.json'],
                        reason: 'Published library compatibility range.',
                    },
                ],
            },
        },
        valid: true,
    },
    {
        name: 'invalid manifest range paths',
        input: {
            dependencies: {
                ranges_allowed: [
                    {
                        paths: [],
                    },
                ],
            },
        },
        valid: false,
        diagnostic: 'gspot.toml: dependencies.ranges_allowed.0.paths:',
    },
    {
        name: 'scope.0.reasoned formatter exclusions',
        input: {
            scope: [
                {
                    path: 'app',
                    tools: {
                        prettier: {
                            exclude: {
                                value: ['generated/**'],
                                reason: 'Reviewed generated output.',
                            },
                        },
                    },
                },
            ],
        },
        valid: true,
    },
    {
        name: 'scope.0.invalid formatter exclusion list',
        input: {
            scope: [
                {
                    path: 'app',
                    tools: {
                        prettier: {
                            exclude: {
                                value: false,
                                reason: 'Reviewed generated output.',
                            },
                        },
                    },
                },
            ],
        },
        valid: false,
        diagnostic: 'gspot.toml: scope.0.tools.prettier.exclude:',
    },
    {
        name: 'scope.0.reasoned registry hosts',
        input: {
            scope: [
                {
                    path: 'app',
                    dependencies: {
                        registry_hosts: {
                            value: ['registry.example.test'],
                            reason: 'Reviewed package registry.',
                        },
                    },
                },
            ],
        },
        valid: true,
    },
    {
        name: 'scope.0.invalid registry host',
        input: {
            scope: [
                {
                    path: 'app',
                    dependencies: {
                        registry_hosts: [false],
                    },
                },
            ],
        },
        valid: false,
        diagnostic: 'gspot.toml: scope.0.dependencies.registry_hosts:',
    },
    {
        name: 'scope.0.reasoned manifest range allowance',
        input: {
            scope: [
                {
                    path: 'app',
                    dependencies: {
                        ranges_allowed: [
                            {
                                paths: ['packages/library/package.json'],
                                reason: 'Published library compatibility range.',
                            },
                        ],
                    },
                },
            ],
        },
        valid: true,
    },
    {
        name: 'scope.0.invalid manifest range paths',
        input: {
            scope: [
                {
                    path: 'app',
                    dependencies: {
                        ranges_allowed: [
                            {
                                paths: [],
                            },
                        ],
                    },
                },
            ],
        },
        valid: false,
        diagnostic: 'gspot.toml: scope.0.dependencies.ranges_allowed.0.paths:',
    },
    {
        name: 'reasoned prose vocabulary',
        input: {
            prose: {
                vocabulary: {
                    value: ['NebulaConfiguration'],
                    reason: 'Reviewed project name.',
                },
            },
        },
        valid: true,
    },
    {
        name: 'invalid prose vocabulary',
        input: {
            prose: {
                vocabulary: {
                    value: [false],
                    reason: 'Reviewed project name.',
                },
            },
        },
        valid: false,
        diagnostic: 'gspot.toml: prose.vocabulary:',
    },
];
