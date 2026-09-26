import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
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

const CASES: FindingCase[] = [
    {
        check: 'cloudflare/wrangler-config',
        files: { 'wrangler.jsonc': '{\n    "name": "planted"\n}\n' },
        expected: { file: 'wrangler.jsonc', rule: 'compatibility-date', line: 1 },
    },
    {
        check: 'cloudflare/headers-syntax',
        files: { _headers: '    X-Frame-Options: DENY\n/*\n    Referrer-Policy no-referrer\n' },
        expected: { file: '_headers', rule: 'headers-syntax', line: 1 },
    },
    {
        check: 'cloudflare/redirects-syntax',
        files: { _redirects: '/old /new 999\n' },
        expected: { file: '_redirects', rule: 'redirects-syntax', line: 1 },
    },
];

describe('the cloudflare configuration', () => {
    test.each(CASES)(
        '$check rejects $expected.rule in $expected.file and accepts corrected source',
        async (planted) => {
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
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failedReport = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(failedReport.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failedReport.checks[0]?.findings).toContainEqual(
                containing({ check: planted.check, ...planted.expected }),
            );
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
