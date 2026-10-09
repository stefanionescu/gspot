import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { PACKAGE, WRANGLER } from '#tests/config/samples/cloudflare.ts';
import type { InProcessScenario } from '#tests/types/harness/repository.ts';

export const REPOSITORY: InProcessScenario = {
    configurations: ['cloudflare'],

    files: {
        'package.json': PACKAGE,
        'wrangler.jsonc': WRANGLER,
        _headers: '/*\n    X-Frame-Options: DENY\n',
        _redirects: '# Old addresses.\n/old /new 301\n/docs/* https://docs.example.test/:splat 302\n',
        'functions/hello.js':
            '// Says hello.\n\n/**\n * Answers every request.\n * @returns {Response} the greeting\n */\nexport function onRequest() {\n    return new Response("hello");\n}\n',
    },
};

export const CASES: FindingCase[] = [
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

export const WRANGLER_SCHEMA = {
    allowTrailingCommas: true,
    type: 'object',
    properties: {
        workers_dev: {
            default: true,
            description: 'Whether we use <name>.<subdomain>.workers.dev to test and deploy your Worker.',
            type: 'boolean',
        },
    },
};
