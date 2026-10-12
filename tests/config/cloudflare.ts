const WRANGLER_SCHEMA = {
    allowTrailingCommas: true,
    type: 'object',
    properties: {
        workers_dev: {
            default: true,
            description: 'Whether we use <name>.<subdomain>.workers.dev to test and deploy your Worker.',
            type: 'boolean',
        },
    },
} as const;

const WRANGLER_CASE = [
    {
        check: 'cloudflare/wrangler',
        files: {
            'wrangler.jsonc': `{
    "name": "example"
}
`,
        },
        expected: { file: 'wrangler.jsonc', rule: 'compatibility-date', line: 1 },
    },
] as const;

const WRANGLER_PACKAGE_JSON = `{
    "name": "example",
    "private": true,
    "devDependencies": { "wrangler": "4.141.0" }
}
`;

const WRANGLER = `{
    // The worker of the test site.
    "name": "example",
    "compatibility_date": "2026-01-15"
}
`;

const CLOUDFLARE_SANDBOX = {
    configurations: ['cloudflare'],
    dependencies: { wrangler: '4.141.0' },
    files: { 'package.json': WRANGLER_PACKAGE_JSON, 'wrangler.jsonc': WRANGLER },
} as const;

const WRANGLER_FIXED = { name: 'fixed', compatibility_date: '2026-01-15', workers_dev: true } as const;
const WRANGLER_BROKEN = { ...WRANGLER_FIXED, name: 42, workers_dev: 'wrong' } as const;

const WRANGLER_FORMATS = [
    {
        name: 'wrangler.toml',
        broken:
            Object.entries(WRANGLER_BROKEN)
                .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
                .join('\n') + '\n',
        corrected:
            Object.entries(WRANGLER_FIXED)
                .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
                .join('\n') + '\n',
    },
    {
        name: 'wrangler.json',
        broken: JSON.stringify(WRANGLER_BROKEN) + '\n',
        corrected: JSON.stringify(WRANGLER_FIXED) + '\n',
    },
    {
        name: 'wrangler.jsonc',
        broken: JSON.stringify(WRANGLER_BROKEN).replace('{', '{// Native JSONC input.\n') + '\n',
        corrected: JSON.stringify(WRANGLER_FIXED).replace('{', '{// Native JSONC input.\n') + '\n',
    },
] as const;

/** Selected platform rules and JavaScript rules retain their separate scope applicability. */
const PLATFORM_PATH_CASES = [
    {
        configuration: 'cloudflare',
        settings: `[[scope]]
path = "api"

[[scope]]
path = "sibling"

configurations = ["javascript"]
removed_configurations = ["cloudflare"]
`,
        files: {
            'src/worker.js': `fetch(new URL(request.url).searchParams.get("target"));
headers.set("Access-Control-Allow-Origin", "*");
`,
            'api/src/worker.js': `fetch(new URL(request.url).searchParams.get("target"));
headers.set("Access-Control-Allow-Origin", "*");
`,
            'sibling/src/worker.js': `fetch(new URL(request.url).searchParams.get("target"));
headers.set("Access-Control-Allow-Origin", "*");
`,
        },
        corrected: {
            'src/worker.js':
                'fetch("https://example.com");\nheaders.set("Access-Control-Allow-Origin", "https://example.com");\n',
            'api/src/worker.js':
                'fetch("https://example.com");\nheaders.set("Access-Control-Allow-Origin", "https://example.com");\n',
            'sibling/src/worker.js':
                'fetch("https://example.com");\nheaders.set("Access-Control-Allow-Origin", "*");\n',
        },
        expected: [
            { file: 'src/worker.js', line: 1, rule: 'gspot.javascript.ssrf-web-request-user-input' },
            { file: 'api/src/worker.js', line: 1, rule: 'gspot.javascript.ssrf-web-request-user-input' },
            { file: 'sibling/src/worker.js', line: 1, rule: 'gspot.javascript.ssrf-web-request-user-input' },
        ],
        allExpected: [
            { file: 'src/worker.js', line: 2, rule: 'gspot.cloudflare.no-wildcard-cors-origin' },
            { file: 'api/src/worker.js', line: 2, rule: 'gspot.cloudflare.no-wildcard-cors-origin' },
        ],
    },
    {
        configuration: 'supabase',
        settings: `[supabase]
functions_folder = "edge"
[[scope]]
path = "api"

[scope.supabase]
functions_folder = "api/custom"
[[scope]]
path = "sibling"

removed_configurations = ["supabase"]
`,
        files: {
            'edge/input.js': 'await req.json();\n',
            'api/custom/input.js': 'await req.json();\n',
            'outside/input.js': 'await req.json();\n',
            'sibling/custom/input.js': 'await req.json();\n',
        },
        corrected: {
            'edge/input.js': 'const body = await req.json(); schema.parse(body);\n',
            'api/custom/input.js': 'const body = await req.json(); schema.parse(body);\n',
        },
        expected: [
            { file: 'edge/input.js', line: 1, rule: 'gspot.supabase.edge-unvalidated-json-body' },
            { file: 'api/custom/input.js', line: 1, rule: 'gspot.supabase.edge-unvalidated-json-body' },
        ],
        allExpected: [],
    },
] as const;

const CLOUDFLARE_REDIRECTS = `/old /new 200
/old /new 301
/old /new 302
/old /new 303
/old /new 307
/old /new 308
/old /new
/old /new 404
/old /new 410
/old /new 302!
`;

const CLOUDFLARE_HEADERS = `  Header-before-path: value
# Comment
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  Content-Security-Policy: frame-ancestors none
/assets/*
  X-Frame-Options: INVALID
  No colon
`;

export {
    WRANGLER,
    WRANGLER_CASE,
    WRANGLER_SCHEMA,
    WRANGLER_FORMATS,
    CLOUDFLARE_SANDBOX,
    CLOUDFLARE_HEADERS,
    PLATFORM_PATH_CASES,
    CLOUDFLARE_REDIRECTS,
};
