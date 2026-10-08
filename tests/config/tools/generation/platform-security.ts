/** Selected platform rules and JavaScript rules retain their separate scope applicability. */
export const PLATFORM_PATH_CASES = [
    {
        configuration: 'cloudflare',
        policy: '[scope.api]\n[scope.sibling]\nconfigurations = ["javascript"]\nremoved_configurations = ["cloudflare"]\n',
        files: {
            'src/worker.js':
                'fetch(new URL(request.url).searchParams.get("target"));\nheaders.set("Access-Control-Allow-Origin", "*");\n',
            'api/src/worker.js':
                'fetch(new URL(request.url).searchParams.get("target"));\nheaders.set("Access-Control-Allow-Origin", "*");\n',
            'sibling/src/worker.js':
                'fetch(new URL(request.url).searchParams.get("target"));\nheaders.set("Access-Control-Allow-Origin", "*");\n',
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
        policy: '[supabase]\nfunctions_folder = "edge"\n[scope.api]\n[scope.api.supabase]\nfunctions_folder = "custom"\n[scope.sibling]\nremoved_configurations = ["supabase"]\n',
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
];
