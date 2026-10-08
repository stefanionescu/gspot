export const JAVASCRIPT_LANGUAGES =
    '{"aliases":{"javascript-typescript":"javascript"},"extractors":{"javascript":[{}]}}';

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
};

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
};

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
};
