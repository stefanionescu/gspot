import type { RuntimeSchemaCase } from '#tests/types/cli/policy/schema.ts';

/** Saved exceptions use the same accepted shapes at the root and in a project scope. */
export const EXCEPTION_SCHEMA_CASES: RuntimeSchemaCase[] = [
    {
        name: 'removed documentation path exception setting',
        input: {
            docs: {
                exclude: [
                    {
                        paths: ['example.ts'],
                        reason: 'This example belongs to its titled code block.',
                    },
                ],
            },
        },
        valid: false,
        diagnostic: '`exclude` is not a setting gspot knows under [docs]',
    },
    {
        name: 'removed CodeQL finding exception setting',
        input: {
            tools: {
                codeql: {
                    ignore: [
                        {
                            rule: 'example',
                            paths: ['source.ts'],
                            reason: 'This sandbox demonstrates an accepted finding.',
                        },
                    ],
                },
            },
        },
        valid: false,
        diagnostic: '`ignore` is not a setting gspot knows under [tools.codeql]',
    },
    {
        name: 'removed formatter exclusion setting',
        input: {
            tools: {
                prettier: {
                    exclude: ['generated/**'],
                },
            },
        },
        valid: false,
        diagnostic: '`exclude` is not a setting gspot knows under [tools.prettier]',
    },
    {
        name: 'invalid formatter exclusion list',
        input: {
            tools: {
                prettier: {
                    exclude: false,
                },
            },
        },
        valid: false,
        diagnostic: '`exclude` is not a setting gspot knows under [tools.prettier]',
    },
    {
        name: 'reasoned registry hosts',
        input: {
            dependencies: {
                registry_hosts: ['registry.example.test'],
            },
            reasons: {
                'dependencies.registry_hosts': 'Reviewed package registry.',
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
        diagnostic: 'gspot.toml: dependencies.registry_hosts.0:',
    },
    {
        name: 'removed manifest range allowance',
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
        valid: false,
        diagnostic: '`ranges_allowed` is not a setting gspot knows under [dependencies]',
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
        diagnostic: '`ranges_allowed` is not a setting gspot knows under [dependencies]',
    },
    {
        name: 'accepted words with reasons',
        input: {
            words: {
                NebulaConfiguration: 'Reviewed project name.',
            },
        },
        valid: true,
    },
    {
        name: 'invalid accepted word map',
        input: {
            words: {
                NebulaConfiguration: false,
            },
        },
        valid: false,
        diagnostic: 'gspot.toml: words.NebulaConfiguration:',
    },
];
