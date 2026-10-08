/** Selected platform scopes scan their sources while neighbors retain their original bytes. */
export const PLATFORM_PATH_CASES = [
    {
        configuration: 'cloudflare',
        policy: '[scope.api]\n[scope.sibling]\nremoved_configurations = ["cloudflare"]\n',
        files: {
            'src/worker.js': 'fetch(new URL(request.url).searchParams.get("target"));\n',
            'api/src/worker.js': 'fetch(new URL(request.url).searchParams.get("target"));\n',
            'sibling/src/worker.js': 'fetch(new URL(request.url).searchParams.get("target"));\n',
        },
        corrected: {
            'src/worker.js': 'fetch("https://example.com");\n',
            'api/src/worker.js': 'fetch("https://example.com");\n',
        },
        expected: [
            { file: 'src/worker.js', line: 1, rule: 'gspot.cloudflare.no-user-controlled-fetch' },
            { file: 'api/src/worker.js', line: 1, rule: 'gspot.cloudflare.no-user-controlled-fetch' },
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
    },
];
