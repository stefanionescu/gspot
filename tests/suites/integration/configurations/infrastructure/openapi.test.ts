import { test } from 'bun:test';

import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

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

const OPENAPI_SANDBOX = {
    configurations: ['openapi'],
    without: ['vitest'],
    files: {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'openapi.yaml': OPENAPI_DOCUMENT,
    },
} as const;

const OPENAPI_CASES = [
    {
        check: 'openapi/spectral',
        files: {
            'openapi.yaml': OPENAPI_DOCUMENT.replace('            operationId: readHealth\n', ''),
        },
        expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
    },
    {
        check: 'openapi/spectral',
        files: {
            'openapi.yaml': `${OPENAPI_DOCUMENT}components:
    securitySchemes:
        basic:
            type: http
            scheme: basic
`,
        },
        expected: { file: 'openapi.yaml', rule: 'owasp:api2:2023-no-http-basic' },
    },
] as const;

const installedSandbox = shareInstalledSandbox(OPENAPI_SANDBOX);

test.each([...OPENAPI_CASES])('$check reports $expected.rule and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});
