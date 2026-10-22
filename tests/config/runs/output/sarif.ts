import { pathToFileURL } from 'node:url';
import { sep, resolve } from 'node:path/posix';

export const CODEQL_REPORT = {
    version: '2.1.0',
    runs: [
        {
            results: [
                {
                    ruleId: 'js/sql-injection',
                    message: { text: 'This query depends on a user-provided value.' },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: 'api/src/users.ts' },
                                region: { startLine: 12 },
                            },
                        },
                    ],
                },
                {
                    ruleId: 'js/path-injection',
                    message: { text: 'This path depends on a user-provided value.' },
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'scripts/build.ts' } } }],
                },
            ],
        },
    ],
} as const;

export const CYCLIC_REPORT = {
    version: '2.1.0',
    runs: [
        {
            originalUriBaseIds: { FIRST: { uriBaseId: 'SECOND' }, SECOND: { uriBaseId: 'FIRST' } },
            results: [
                {
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'source.ts', uriBaseId: 'FIRST' } } }],
                },
            ],
        },
    ],
} as const;

export const ENCODED_REPORT = {
    version: '2.1.0',
    runs: [
        {
            defaultEncoding: 'unsupported-encoding',
            artifacts: [{ location: { uri: 'source.py' }, encoding: 'unsupported-encoding' }],
            results: [
                {
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { index: 0 },
                                region: { charOffset: 100, startLine: 3, startColumn: 2 },
                            },
                        },
                    ],
                },
            ],
        },
    ],
} as const;

export const FAILED_ANALYSES = [
    { executionSuccessful: false },
    { executionSuccessful: true, toolExecutionNotifications: [{ level: 'error' }] },
] as const;

export const POSITIONLESS_RESULTS = [
    { name: 'no region', file: 'missing.py', locations: [{ physicalLocation: { artifactLocation: { index: 0 } } }] },
    {
        name: 'a negative offset',
        file: 'missing.py',
        locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: -1 } } }],
    },
    {
        name: 'an offset past the end',
        file: 'missing.py',
        locations: [{ physicalLocation: { artifactLocation: { index: 0 }, region: { charOffset: 1000 } } }],
    },
    { name: 'no location, so it concerns the repository', file: '', locations: undefined },
] as const;

/** Static Analysis Results Interchange Format (SARIF) source locations and the repository paths they become. */
export const SARIF_LOCATION_CASES = [
    { uri: 'api/some%20file.ts', uriBaseId: '%SRCROOT%' },
    { uri: new URL('api/some%20file.ts', pathToFileURL(`${resolve('selected-source')}${sep}`).href).href },
    { uri: 'some%20file.ts', uriBaseId: 'API' },
    { index: 0 },
] as const;
