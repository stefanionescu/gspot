// Planted repository for the cloudflare preset: a configuration with no date, a header under no path, and a redirect with a status Cloudflare does not know.
import { createSandbox } from '@gspot/testing';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'cloudflare',
    '--without',
    'spelling',
    'naming',
    'security',
    'config-files',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const WRANGLER =
    '{\n    // The worker of the planted site.\n    "name": "planted",\n    "compatibility_date": "2026-01-15"\n}\n';

const CASES: PlantedCase[] = [
    {
        check: 'cloudflare/wrangler-config',
        files: { 'wrangler.jsonc': '{\n    "name": "planted"\n}\n' },
        expected: 'pins no compatibility_date',
    },
    {
        check: 'cloudflare/headers-syntax',
        files: { _headers: '    X-Frame-Options: DENY\n/*\n    Referrer-Policy no-referrer\n' },
        expected: 'This header sits under no path',
    },
    {
        check: 'cloudflare/redirects-syntax',
        files: { _redirects: '/old /new 999\n' },
        expected: 'Cloudflare knows no redirect status 999',
    },
];

describe('the cloudflare preset', () => {
    test(
        'the configuration, headers and redirects checks fire on their planted defects, and the types check waits for a tracked file',
        async () => {
            await using sandbox = await createSandbox({
                'wrangler.jsonc': WRANGLER,
                _headers: '/*\n    X-Frame-Options: DENY\n',
                _redirects: '# Old addresses.\n/old /new 301\n/docs/* https://docs.planted.test/:splat 302!\n',
                'functions/hello.js':
                    '// Says hello.\n\n/**\n * Answers every request.\n * @returns {Response} the greeting\n */\nexport function onRequest() {\n    return new Response("hello");\n}\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec', 'ast-grep']) };
            await install(sandbox.path, INIT, environment);
            for (const id of [...CASES.map((planted) => planted.check), 'cloudflare/env-types-fresh']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
