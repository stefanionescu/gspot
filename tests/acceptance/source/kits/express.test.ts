// Planted repository for the express configuration: an OpenAPI document with a hole, a stale document, and a route with no test.
import { join, delimiter } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { toolsPath, installAtLevel } from '#tests/support/cli/tools.ts';
import { EXPRESS_INIT } from '#tests/config/acceptance/source/kits/init-arguments.ts';
import { HEALTH, DOCUMENT, EXPRESS_POLICY, EXPRESS_PACKAGE } from '#tests/config/acceptance/source/kits/kits.ts';

const NPM_BIN = join(import.meta.dir, '../../../../node_modules/.bin');
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Builds a template; inlining it nests a template inside a template.
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
