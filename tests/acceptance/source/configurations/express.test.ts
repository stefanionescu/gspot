import { delimiter, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the express configuration: an OpenAPI document with a hole, a stale document, and a route with no test.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const NPM_BIN = join(import.meta.dir, '../../../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--configurations',
    'express',
    '--without',
    'naming',
    'spelling',
    'security',
    'vitest',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "dependencies": {\n        "express": "5.1.0"\n    }\n}\n';
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
const POLICY =
    '[tools.openapi]\ndocument = "openapi.yaml"\nproduced_by = "bun write-document.js"\n\n[tools.express]\nroute_files = ["src/routes/*.js"]\n';
const WRITER = (text: string): string => `await Bun.write('openapi.yaml', ${JSON.stringify(text)});\n`;
const HEALTH = 'export function health(_request, response) {\n    response.sendStatus(204);\n}\n';

const CASES: FindingCase[] = [
    {
        check: 'express/openapi-lint',
        files: { 'openapi.yaml': DOCUMENT.replace('            operationId: readHealth\n', '') },
        policy: POLICY,
        expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
    },
    {
        check: 'express/openapi-fresh',
        files: { 'write-document.js': WRITER(`${DOCUMENT}# later\n`) },
        policy: POLICY,
        expected: { file: 'openapi.yaml', rule: 'stale', line: 1 },
    },
    {
        check: 'express/routes-tested',
        files: {
            'src/routes/orders.js': HEALTH,
            'src/routes/orders.test.js': "// orders has no importing test.\nexport const label = 'orders';\n",
        },
        policy: POLICY,
        expected: { file: 'src/routes/orders.js', rule: 'untested-route', line: 1 },
    },
];

describe('the express configuration', () => {
    test.each(CASES)(
        '$check reports $expected.rule in $expected.file and accepts correction',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'package.json': PACKAGE,
                'openapi.yaml': DOCUMENT,
                'write-document.js': WRITER(DOCUMENT),
                'src/routes/health.js': HEALTH,
                'src/routes/health.test.js':
                    "import { health } from './health.js';\n\nexport const subject = health;\n",
            });
            commitAll(sandbox.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
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
