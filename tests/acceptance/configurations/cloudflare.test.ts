import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the cloudflare configuration: a configuration with no date, a header under no path, and a redirect with a status Cloudflare does not know.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'cloudflare',
    '--without',
    'spelling',
    'naming',
    'security',
    'configs',
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

describe('the cloudflare configuration', () => {
    test(
        'the configuration, headers and redirects checks fire on their planted defects, and the types check waits for a tracked file',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'wrangler.jsonc': WRANGLER,
                _headers: '/*\n    X-Frame-Options: DENY\n',
                _redirects: '# Old addresses.\n/old /new 301\n/docs/* https://docs.planted.test/:splat 302!\n',
                'functions/hello.js':
                    '// Says hello.\n\n/**\n * Answers every request.\n * @returns {Response} the greeting\n */\nexport function onRequest() {\n    return new Response("hello");\n}\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec', 'ast-grep']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
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
