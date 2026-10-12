export const CODEQL_REPORT = {
    version: '2.1.0',
    runs: [
        {
            results: [
                {
                    ruleId: 'js/sql-injection',
                    message: { text: 'This query depends on a user-provided value.' },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: 'api/src/users.ts' },
                                region: { startLine: 12 },
                            },
                        },
                    ],
                },
                {
                    ruleId: 'js/path-injection',
                    message: { text: 'This path depends on a user-provided value.' },
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'scripts/build.ts' } } }],
                },
            ],
        },
    ],
} as const;

export const CYCLIC_REPORT = {
    version: '2.1.0',
    runs: [
        {
            originalUriBaseIds: { FIRST: { uriBaseId: 'SECOND' }, SECOND: { uriBaseId: 'FIRST' } },
            results: [
                {
                    locations: [{ physicalLocation: { artifactLocation: { uri: 'source.ts', uriBaseId: 'FIRST' } } }],
                },
            ],
        },
    ],
} as const;

export const ENCODED_REPORT = {
    version: '2.1.0',
    runs: [
        {
            defaultEncoding: 'unsupported-encoding',
            artifacts: [{ location: { uri: 'source.py' }, encoding: 'unsupported-encoding' }],
            results: [
                {
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { index: 0 },
                                region: { charOffset: 100, startLine: 3, startColumn: 2 },
                            },
                        },
                    ],
                },
            ],
        },
    ],
} as const;

export const CODEQL_SAMPLE = `from flask import request
import sqlite3

def query():
    value = request.args.get("name")
    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = " + value)
`;

export const CODEQL_FIXED = `from flask import request
import sqlite3

def query():
    value = request.args.get("name")
    sqlite3.connect("db.sqlite").execute("SELECT * FROM users WHERE name = ?", (value,))
`;

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

/** Project evidence that keeps every selected security configuration after apply. */
export const SEMGREP_PROJECT_FILES = {
    'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"express":"5.2.1"}}\n',
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

/** Samples beside documented forms and project-owned validators and server factories. */
export const PLATFORM_SOURCES = {
    'scripts/inject.js': 'execSync(`printf ${input}`);\n',
    'functions/validated.js': 'const body = await request.json(); schema.parse(body);\n',
    'supabase/functions/admin/index.ts': 'createClient("https://example.com", process.env.SERVICE_ROLE_KEY);\n',
    'supabase/functions/factory/index.ts': 'const admin = createAdminClient();\n',
    'src/rpc-input.js': 'const req = { body: validatedData }; client.rpc("write", req.body);\n',
    'Info.plist': '<plist><dict><key>NSAllowsArbitraryLoads</key><true/></dict></plist>\n',
    'Allowed.plist':
        '<plist><dict><key>NSAppTransportSecurity</key><dict><key>NSExceptionDomains</key><dict><key>example.com</key><dict/></dict></dict></dict></plist>\n',
    'functions/input.js': 'fetch(new URL(request.url).searchParams.get("target"));\n',
    'functions/proxy.js': 'fetch(context.request.url, { cf: { cacheTtl: 5 } });\n',
    'supabase/functions/_shared/cors.ts': 'export const headers = { "Access-Control-Allow-Origin": "*" };\n',
    'supabase/functions/cors/index.ts':
        'export const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" };\n',
    'supabase/functions/eval/index.ts': 'eval(input);\n',
    'supabase/functions/remote/index.ts': 'const loaded = import(modulePath);\n',
    'supabase/functions/lazy/index.ts': 'const loaded = import("./local.ts");\n',
    'src/rpc.js': 'client.rpc(`fetch_${name}`);\n',
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
    { file: 'scripts/inject.js', rule: 'gspot.javascript.no-interpolated-exec', line: 1 },
    { file: 'src/filter.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'src/list.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'src/search.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'supabase/functions/cors/index.ts', rule: 'gspot.supabase.edge-cors-wildcard-with-credentials', line: 1 },
] as const;

/** Worker cross-origin resource sharing (CORS) rules at all cover every source in the scope. */
export const PLATFORM_ALL_SOURCE_FINDINGS = [
    { file: 'supabase/functions/_shared/cors.ts', rule: 'gspot.cloudflare.no-wildcard-cors-origin', line: 1 },
    { file: 'supabase/functions/cors/index.ts', rule: 'gspot.cloudflare.no-wildcard-cors-origin', line: 1 },
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
    'supabase/functions/eval/index.ts': 'const parsed = Number(input);\n',
    'supabase/functions/remote/index.ts': 'const loaded = import("./local.ts");\n',
} as const;

export const OWN_RULE_SOURCE = `export function double(value: number): number {
    return value * 2;
}
`;

export const OWN_RULE = `rules:
    - id: test-no-double
      pattern: double(...)
      message: The test rule of the repository fires here.
      languages: [typescript]
      severity: ERROR
`;

export const FAILED_INVOCATIONS = [
    { executionSuccessful: false },
    { executionSuccessful: true, toolExecutionNotifications: [{ level: 'error' }] },
] as const;

export const POSITIONLESS_REGIONS = [
    { name: 'no region', region: undefined },
    { name: 'negative offset', region: { charOffset: -1 } },
    { name: 'large offset', region: { charOffset: 1000 } },
] as const;

export const CODEQL_FILE = 'query.py';
