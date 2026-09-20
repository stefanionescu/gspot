import { createFixture } from 'fs-fixture';
// Planted repository for the express preset: an OpenAPI document with a hole, a stale document, and a route with no test.
import { delimiter, join } from 'node:path';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const NPM_BIN = join(import.meta.dir, '../../node_modules/.bin');
const INIT = [
    'init',
    '--yes',
    '--presets',
    'express',
    '--without',
    'naming,spelling,security,vitest',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
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
        files: { 'src/routes/orders.js': HEALTH },
        policy: POLICY,
        expected: 'No test file names orders',
    },
];

describe('the express preset', () => {
    test(
        'the OpenAPI checks and the route test check fire on their planted defects',
        async () => {
            await using fixture = await createFixture({
                'package.json': PACKAGE,
                'openapi.yaml': DOCUMENT,
                'write-document.js': WRITER(DOCUMENT),
                'src/routes/health.js': HEALTH,
                'src/routes/health.test.js':
                    "import { health } from './health.js';\n\nexport const subject = health;\n",
            });
            commitAll(fixture.path);
            const environment = { PATH: `${NPM_BIN}${delimiter}${toolsPath(['typos', 'ec', 'ast-grep'])}` };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = await runPlanted(fixture.path, { ...planted, files: {} }, environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const openapi = await run(fixture.path, ['check', 'express/openapi-lint', '--no-cache'], environment);
            expect(openapi.code).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
