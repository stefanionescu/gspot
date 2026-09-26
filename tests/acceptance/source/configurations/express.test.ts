import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
// Planted repository for the express configuration: an OpenAPI document with a hole, a stale document, and a route with no test.
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { EXPRESS_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';

import {
    DOCUMENT,
    EXPRESS_PACKAGE,
    EXPRESS_POLICY,
    HEALTH,
} from '#tests/constants/acceptance/source/configurations/configurations.ts';

const NPM_BIN = join(import.meta.dir, '../../../../node_modules/.bin');
const WRITER = (text: string): string => `await Bun.write('openapi.yaml', ${JSON.stringify(text)});\n`;
const CASES: FindingCase[] = [
    {
        check: 'express/openapi-lint',
        files: { 'openapi.yaml': DOCUMENT.replace('            operationId: readHealth\n', '') },
        policy: EXPRESS_POLICY,
        expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
    },
    {
        check: 'express/openapi-fresh',
        files: { 'write-document.js': WRITER(`${DOCUMENT}# later\n`) },
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
    },
];

describe('the express configuration', () => {
    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts correction',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'package.json': EXPRESS_PACKAGE,
                'openapi.yaml': DOCUMENT,
                'write-document.js': WRITER(DOCUMENT),
                'src/routes/health.js': HEALTH,
                'src/routes/health.test.js':
                    "import { health } from './health.js';\n\nexport const subject = health;\n",
            });
            commitAll(sandbox.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
            await installAtLevel(sandbox.path, EXPRESS_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            if (planted.check === 'express/routes-tested') {
                await createFileTree(sandbox.path, {
                    'src/routes/orders.js': HEALTH,
                    'src/routes/orders.test.js':
                        'import { health } from "./orders.js";\nexport const subject = health;\n',
                });
            }
            const corrected = await runPlanted(sandbox.path, { ...planted, files: {} }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(
                reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json()).checks,
            ).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
