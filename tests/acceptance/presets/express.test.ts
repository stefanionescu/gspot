// Planted repository for the express preset: an OpenAPI document with a hole, a stale document, and a route with no test.
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/support/cli/planted.ts';

const NPM_BIN = join(import.meta.dir, '../../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--presets',
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
    '[tools.openapi]\ndocument = "openapi.yaml"\nproduced_by = "bun write-document.js"\n\n[tools.express]\nroute_glob = ["src/routes/*.js"]\n';
const WRITER = (text: string): string => `await Bun.write('openapi.yaml', ${JSON.stringify(text)});\n`;
const HEALTH = 'export function health(_request, response) {\n    response.sendStatus(204);\n}\n';

const CASES: PlantedCase[] = [
    {
        check: 'express/openapi-lint',
        files: { 'openapi.yaml': DOCUMENT.replace('            operationId: readHealth\n', '') },
        policy: POLICY,
        expected: 'operation-operationId',
    },
    {
        check: 'express/openapi-fresh',
        files: { 'write-document.js': WRITER(`${DOCUMENT}# later\n`) },
        policy: POLICY,
        expected: 'changes this document',
    },
    {
        check: 'express/routes-tested',
        files: {
            'src/routes/orders.js': HEALTH,
            'src/routes/orders.test.js': "// orders has no importing test.\nexport const label = 'orders';\n",
        },
        policy: POLICY,
        expected: 'No test in this scope imports src/routes/orders.js',
    },
];

describe('the express preset', () => {
    test(
        'the OpenAPI checks and the route test check fire on their planted defects',
        async () => {
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
            for (const planted of CASES) {
                const clean = await runPlanted(sandbox.path, { ...planted, files: {} }, environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const openapi = await run(
                sandbox.path,
                ['check', '--only', 'express/openapi-lint', '--no-cache'],
                environment,
            );
            expect(openapi.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
