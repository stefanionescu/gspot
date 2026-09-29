// Planted repository for the express configuration: an OpenAPI document with a hole, a stale document, and a route with no test.
import { plantedCases } from '#tests/support/cli/planted.ts';

import {
    HEALTH,
    DOCUMENT,
    EXPRESS_POLICY,
    documentWriter,
    EXPRESS_PACKAGE,
} from '#tests/inputs/acceptance/source/kits/kits.ts';

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
        {
            check: 'openapi/fresh',
            files: { 'write-document.js': documentWriter(`${DOCUMENT}# later\n`) },
            policy: EXPRESS_POLICY,
            expected: { file: 'openapi.yaml', rule: 'stale', line: 1 },
        },
        {
            check: 'express/routes-tested',
            files: {
                'src/routes/orders.js': HEALTH,
                'src/routes/orders.test.js': "// orders has no importing test.\nexport const label = 'orders';\n",
            },
            policy: EXPRESS_POLICY,
            expected: { file: 'src/routes/orders.js', rule: 'untested-route', line: 1 },
            corrected: {
                files: {
                    'src/routes/orders.js': HEALTH,
                    'src/routes/orders.test.js':
                        'import { health } from "./orders.js";\nexport const subject = health;\n',
                },
            },
        },
    ],
);
