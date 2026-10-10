import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const OPENAPI_POLICY = '[openapi]\ndocument = "openapi.yaml"\ngenerate_command = ["bun", "write-document.js"]\n';

export const DOCUMENT = `openapi: 3.1.0
info:
    title: Test
    version: 1.0.0
    description: The test service.
    contact:
        name: Owner
        url: https://example.test
servers:
    - url: https://example.test
tags:
    - name: health
paths:
    /health:
        get:
            operationId: readHealth
            description: Says the service is up.
            tags:
                - health
            responses:
                '204':
                    description: The service is up.
`;

export const REPOSITORY: InstalledScenario = {
    configurations: ['openapi'],

    without: ['vitest'],
    files: {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'openapi.yaml': DOCUMENT,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'openapi/spectral',
        policy: OPENAPI_POLICY,
        files: {
            'openapi.yaml':
                "openapi: 3.1.0\ninfo:\n    title: Test\n    version: 1.0.0\n    description: The test service.\n    contact:\n        name: Owner\n        url: https://example.test\nservers:\n    - url: https://example.test\ntags:\n    - name: health\npaths:\n    /health:\n        get:\n            description: Says the service is up.\n            tags:\n                - health\n            responses:\n                '204':\n                    description: The service is up.\n",
        },
        expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
    },
];
