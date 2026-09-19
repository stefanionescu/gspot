// Planted repository for the cloudflare preset: a configuration with no date, a header under no path, and a redirect with a status Cloudflare does not know.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'cloudflare',
    '--without',
    'spelling,naming,security,config-files',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const WRANGLER =
    '{\n    // The worker of the planted site.\n    "name": "planted",\n    "compatibility_date": "2026-01-15"\n}\n';

const CASES: PlantedCase[] = [
    {
        id: 'cloudflare/wrangler-config',
        files: { 'wrangler.jsonc': '{\n    "name": "planted"\n}\n' },
        expected: 'pins no compatibility_date',
    },
    {
        id: 'cloudflare/headers-syntax',
        files: { _headers: '    X-Frame-Options: DENY\n/*\n    Referrer-Policy no-referrer\n' },
        expected: 'This header sits under no path',
    },
    {
        id: 'cloudflare/redirects-syntax',
        files: { _redirects: '/old /new 999\n' },
        expected: 'Cloudflare knows no redirect status 999',
    },
];

describe('the cloudflare preset', () => {
    test(
        'the configuration, headers and redirects checks fire on their planted defects, and the types check waits for a tracked file',
        async () => {
            await using fixture = await createFixture({
                'wrangler.jsonc': WRANGLER,
                _headers: '/*\n    X-Frame-Options: DENY\n',
                _redirects: '# Old addresses.\n/old /new 301\n/docs/* https://docs.planted.test/:splat 302!\n',
                'functions/hello.js':
                    '// Says hello.\n\n/**\n * Answers every request.\n * @returns {Response} the greeting\n */\nexport function onRequest() {\n    return new Response("hello");\n}\n',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['typos', 'ec', 'ast-grep']) };
            await install(fixture.path, INIT, environment);
            for (const id of [...CASES.map((planted) => planted.id), 'cloudflare/env-types-fresh']) {
                const clean = run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
