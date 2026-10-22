const OPENAPI_DOCUMENT = `openapi: 3.1.0
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

export const OPENAPI_SANDBOX = {
    configurations: ['openapi'],
    without: ['vitest'],
    files: {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'openapi.yaml': OPENAPI_DOCUMENT,
    },
} as const;

export const OPENAPI_CASES = [
    {
        check: 'openapi/spectral',
        files: {
            'openapi.yaml': OPENAPI_DOCUMENT.replace('            operationId: readHealth\n', ''),
        },
        expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
    },
] as const;
