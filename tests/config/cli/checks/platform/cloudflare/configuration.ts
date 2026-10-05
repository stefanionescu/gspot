import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const WRANGLER =
    '{\n    // The worker of the test site.\n    "name": "example",\n    "compatibility_date": "2026-01-15"\n}\n';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['cloudflare'],
    modules: false,
    installs: false,
    files: {
        'package.json':
            '{\n    "name": "example",\n    "private": true,\n    "devDependencies": { "wrangler": "4.0.0" }\n}\n',
        'wrangler.jsonc': WRANGLER,
        _headers: '/*\n    X-Frame-Options: DENY\n',
        _redirects: '# Old addresses.\n/old /new 301\n/docs/* https://docs.example.test/:splat 302!\n',
        'functions/hello.js':
            '// Says hello.\n\n/**\n * Answers every request.\n * @returns {Response} the greeting\n */\nexport function onRequest() {\n    return new Response("hello");\n}\n',
    },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'cloudflare/wrangler',
        files: { 'wrangler.jsonc': '{\n    "name": "example"\n}\n' },
        expected: { file: 'wrangler.jsonc', rule: 'compatibility-date', line: 1 },
    },
    {
        check: 'cloudflare/headers',
        files: { _headers: '    X-Frame-Options: DENY\n/*\n    Referrer-Policy no-referrer\n' },
        expected: { file: '_headers', rule: 'syntax', line: 1 },
    },
    {
        check: 'cloudflare/redirects',
        files: { _redirects: '/old /new 999\n' },
        expected: { file: '_redirects', rule: 'syntax', line: 1 },
    },
];
