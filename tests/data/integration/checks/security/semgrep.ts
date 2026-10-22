import { BASE_INSTALLED_FILES } from '#tests/data/setup/sandboxes.ts';

export const NEXT_CONFIG_CASES = [
    {
        name: 'keys after a nested env value',
        source: `export default {\n  env: {\n    NESTED: { API_TOKEN: "nested text" },\n    "API_SECRET": process.env.API_SECRET,\n    ["PASSWORD"]: process.env.PASSWORD,\n    TOKEN,\n  },\n  typescript: { ["ignoreBuildErrors"]: (true as const) },\n};\n`,
        expected: [
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 4,
                rule: 'gspot.nextjs.env-secret',
                message: 'API_SECRET under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 5,
                rule: 'gspot.nextjs.env-secret',
                message: 'PASSWORD under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 6,
                rule: 'gspot.nextjs.env-secret',
                message: 'TOKEN under env is written into the client bundle. Read it on the server.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 8,
                rule: 'gspot.nextjs.checks-off',
                message: 'ignoreBuildErrors: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
        ],
    },
    {
        name: 'quoted and asserted literal disabled checks',
        source: `export default {\n  eslint: { "ignoreDuringBuilds": true satisfies boolean },\n  typescript: { ignoreBuildErrors: <boolean>true },\n};\n`,
        expected: [
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 2,
                rule: 'gspot.nextjs.checks-off',
                message: 'ignoreDuringBuilds: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
            {
                check: 'security/semgrep',
                file: 'next.config.ts',
                line: 3,
                rule: 'gspot.nextjs.checks-off',
                message: 'ignoreBuildErrors: true lets next build pass with errors. Remove it.',
                fixable: false,
            },
        ],
    },
    {
        name: 'comments, strings, false flags, and nested env values',
        source: `// env: { API_SECRET: "comment" }\nconst text = "ignoreBuildErrors: true";\nexport default {\n  env: { SETTINGS: { API_TOKEN: text }, PUBLIC_ENDPOINT: "https://example.com" },\n  eslint: { ignoreDuringBuilds: false },\n  typescript: { ignoreBuildErrors: enabled },\n};\n`,
        expected: [],
    },
] as const;

/** Keychain and hashing samples beside a safe keychain setting. */
export const SWIFT_SAMPLE = `let access = kSecAttrAccessibleAlways
let hash = Insecure.MD5
let background = kSecAttrAccessibleAfterFirstUnlock
`;

/** Shell downloads executed through pipelines, process substitution, and command substitution. */
export const BASH_DOWNLOAD_SAMPLE = String.raw`#!/usr/bin/env bash
curl https://example.com/setup.sh | bash
eval "$1"
curl https://example.com/setup.sh | sudo bash
bash <(curl https://example.com/setup.sh)
sh -c "$(curl https://example.com/setup.sh)"
wget -qO- https://example.com/setup.sh | bash -s
printf '%s\n' 'curl https://example.com/setup.sh | bash'
# curl https://example.com/setup.sh | bash
curl -o setup.sh https://example.com/setup.sh
`;

/** Project files that keep each security configuration active after apply. */
export const SEMGREP_PROJECT_FILES = {
    'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"express":"0.0.0-test"}}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': `[project]
name = "example"
version = "1.0.0"
dependencies = ["fastapi"]
`,
    'src/index.ts': 'export const answer = 42;\n',
    'script.sh': '#!/usr/bin/env bash\nprintf "%s\\n" "Ready"\n',
    'Value.swift': 'let answer = 42\n',
    'wrangler.toml': 'name = "example"\ncompatibility_date = "2026-01-01"\n',
    'supabase/config.toml': 'project_id = "example"\n',
} as const;

/** Samples beside safe documented forms, project validators, and server factories. */
export const PLATFORM_SOURCES = {
    'scripts/inject.js': 'execSync(`printf ${input}`);\n',
    'Info.plist': '<plist><dict><key>NSAllowsArbitraryLoads</key><true/></dict></plist>\n',
    'Allowed.plist':
        '<plist><dict><key>NSAppTransportSecurity</key><dict><key>NSExceptionDomains</key><dict><key>example.com</key><dict/></dict></dict></dict></plist>\n',
    'functions/input.js': 'fetch(new URL(request.url).searchParams.get("target"));\n',
    'functions/proxy.js': 'fetch(context.request.url, { cf: { cacheTtl: 5 } });\n',
    'supabase/functions/_shared/cors.ts': 'export const headers = { "Access-Control-Allow-Origin": "*" };\n',
    'supabase/functions/cors/index.ts':
        'export const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" };\n',
    'src/select.js': 'client.from("users").select(`id,${column}`);\n',
    'src/equal.js': 'client.from("users").filter("name", "eq", `${name}`);\n',
    'src/filter.js': 'client.from("users").or(`id.eq.${input}`);\n',
    'src/list.js': 'client.from("users").filter("id", "in", `(${input})`);\n',
    'src/search.js': 'client.from("docs").textSearch("body", `\'${term}\'`);\n',
    'src/plain.js': 'client.from("docs").textSearch("body", `${term}`, { type: "plain" });\n',
    'src/phrase.js': 'client.from("docs").textSearch("body", `${term}`, { type: "phrase" });\n',
    'src/websearch.js': 'client.from("docs").textSearch("body", `${term}`, { type: "websearch" });\n',
} as const;
export const PLATFORM_SOURCE_FINDINGS = [
    { file: 'functions/input.js', rule: 'gspot.javascript.ssrf-web-request-user-input', line: 1 },
    { file: 'Info.plist', rule: 'arbitrary-loads', line: 1 },
    { file: 'scripts/inject.js', rule: 'gspot.javascript.interpolated-exec', line: 1 },
    { file: 'src/filter.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'src/list.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'src/search.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'supabase/functions/cors/index.ts', rule: 'gspot.supabase.edge-cors-wildcard-with-credentials', line: 1 },
] as const;

/** At level all, the Worker cross-origin resource sharing (CORS) rules cover every source in the scope. */
export const PLATFORM_ALL_SOURCE_FINDINGS = [
    { file: 'supabase/functions/_shared/cors.ts', rule: 'gspot.cloudflare.wildcard-cors-origin', line: 1 },
    { file: 'supabase/functions/cors/index.ts', rule: 'gspot.cloudflare.wildcard-cors-origin', line: 1 },
] as const;
export const PLATFORM_ALL_SOURCE_FIXES = {
    'supabase/functions/_shared/cors.ts':
        'export const headers = { "Access-Control-Allow-Origin": "https://example.com" };\n',
} as const;
export const PLATFORM_SOURCE_FIXES = {
    'Info.plist': '<plist><dict/></plist>\n',
    'scripts/inject.js': 'execFileSync("printf", [input]);\n',
    'functions/input.js': 'fetch("https://example.com/api");\n',
    'src/filter.js': 'client.from("users").eq("id", input);\n',
    'src/list.js': 'client.from("users").in("id", input);\n',
    'src/search.js': 'client.from("docs").textSearch("body", `${term}`, { type: "plain" });\n',
    'supabase/functions/cors/index.ts':
        'export const headers = { "Access-Control-Allow-Origin": "https://example.com", "Access-Control-Allow-Credentials": "true" };\n',
} as const;
export const REPOSITORY_RULE_SOURCE = `export function double(value: number): number {
    return value * 2;
}
`;
export const REPOSITORY_RULE = `rules:
    - id: test-no-double
      pattern: double(...)
      message: The test rule of the repository fires here.
      languages: [typescript]
      severity: ERROR
`;

/** The Semgrep check command for the Semgrep rule and output parser cases. */
export const SEMGREP_CHECK = ['check', '--only', 'security/semgrep', '--json'] as const;
export const SEMGREP_SANDBOX = {
    configurations: [
        'javascript',
        'typescript',
        'python',
        'bash',
        'swift',
        'security',
        'nextjs',
        'express',
        'fastapi',
        'supabase',
        'cloudflare',
    ],
    level: 'all',
    files: BASE_INSTALLED_FILES,
} as const;

/** The findings of the Bash and Swift Semgrep rules. */
export const SECURITY_RULE_FINDINGS = [
    { file: 'Value.swift', line: 1, rule: 'gspot.swift.keychain-accessible-always' },
    { file: 'Value.swift', line: 2, rule: 'gspot.swift.weak-hash-algorithm' },
    { file: 'script.sh', line: 2, rule: 'gspot.bash.curl-pipe-shell' },
    { file: 'script.sh', line: 3, rule: 'gspot.bash.eval' },
    { file: 'script.sh', line: 4, rule: 'gspot.bash.curl-pipe-shell' },
    { file: 'script.sh', line: 5, rule: 'gspot.bash.curl-pipe-shell' },
    { file: 'script.sh', line: 6, rule: 'gspot.bash.curl-pipe-shell' },
    { file: 'script.sh', line: 7, rule: 'gspot.bash.curl-pipe-shell' },
] as const;

/** The Semgrep result for a Bash file that it cannot parse. */
export const MALFORMED_SEMGREP_RESULTS = [
    {
        check: 'security/semgrep',
        status: 'failed',
        findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
    },
] as const;
