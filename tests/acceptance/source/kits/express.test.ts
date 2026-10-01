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
    ],
);
