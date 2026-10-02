// Planted repository for the express configuration: an OpenAPI document with a hole, a stale document, and a route with no test.
import { plantedCases } from '#tests/harness/planted/cases.ts';

const OPENAPI_POLICY = '[tools.openapi]\ndocument = "openapi.yaml"\nproduced_by = "bun write-document.js"\n';

const EXPRESS_PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "express": "5.1.0"\n    }\n}\n';

const EXPRESS_POLICY = `${OPENAPI_POLICY}\n[tools.express]\nroute_files = ["src/routes/*.js"]\n`;

const DOCUMENT = `openapi: 3.1.0
info:
    title: Planted
    version: 1.0.0
    description: The planted service.
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

const HEALTH = 'export function health(_request, response) {\n    response.sendStatus(204);\n}\n';

/**
 * A script the fresh check runs to produce the OpenAPI document.
 * @param text the document the script writes
 * @returns the script
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
function documentWriter(text: string): string {
    return `await Bun.write('openapi.yaml', ${JSON.stringify(text)});\n`;
}

plantedCases(
    'the express configuration',
    {
        kits: ['express'],
        modules: false,
        without: ['naming', 'spelling', 'security', 'vitest'],
        files: {
            'package.json': EXPRESS_PACKAGE,
            'openapi.yaml': DOCUMENT,
            'write-document.js': documentWriter(DOCUMENT),
            'src/routes/health.js': HEALTH,
            'src/routes/health.test.js': "import { health } from './health.js';\n\nexport const subject = health;\n",
        },
    },
    [
        {
            check: 'openapi/lint',
            files: { 'openapi.yaml': DOCUMENT.replace('            operationId: readHealth\n', '') },
            policy: EXPRESS_POLICY,
            expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
        },
    ],
);
