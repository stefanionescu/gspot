export const EXPRESS_SCOPE_SETTINGS = `[[scope]]
path = "app"

configurations = ["express"]
[[scope]]
path = "app/child"

[[scope]]
path = "sibling"

`;

export const EXPRESS_SCOPE_FILES = {
    'app/package.json': '{"name":"security-app","private":true,"dependencies":{"express":"0.0.0-test"}}',
    'source.js': 'res.send(req.body.message);\n',
    'app/source.js': 'res.send(req.body.message);\n',
    'app/child/source.js': 'res.send(req.body.message);\n',
    'sibling/source.js': 'res.send(req.body.message);\n',
} as const;

export const EXPRESS_SOURCES = {
    'logger.js': 'logger.info(`User ${req.query.name}`);\n',
    'json.js': 'res.json({ name: req.query.name });\n',
    'query-object.js': 'res.send(req.query);\n',
    'parameterized.js': 'db.query("SELECT * FROM users WHERE id = $1", [req.query.id]);\n',
    'field.js': 'res.send(req.query.name);\n',
    'response-template.js': 'res.send(`<p>${req.query.name}</p>`);\n',
    'query-template.js': 'db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n',
    'execute-template.js': 'db.execute(`DELETE FROM users WHERE id = ${req.params.id}`);\n',
} as const;

export const EXPRESS_SOURCE_FINDINGS = [
    { file: 'execute-template.js', rule: 'gspot.express.raw-query-interpolation', line: 1 },
    { file: 'field.js', rule: 'gspot.express.res-send-raw-input', line: 1 },
    { file: 'query-template.js', rule: 'gspot.express.raw-query-interpolation', line: 1 },
    { file: 'response-template.js', rule: 'gspot.express.res-send-raw-input', line: 1 },
] as const;

export const EXPRESS_RESPONSE_CASES = [
    { rule: 'unvalidated-redirect', source: 'res.redirect(req.query.next);\n', fixed: 'res.redirect("/home");\n' },
    {
        rule: 'stack-trace-in-response',
        source: 'res.json({ stack: error.stack });\n',
        fixed: 'res.json({ error: "Request failed" });\n',
    },
] as const;

export const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

export const FASTAPI_CONFIGURATION_CASES = [
    {
        rule: 'cors-wildcard-with-credentials',
        source: 'app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True)\n',
        fixed: 'app.add_middleware(CORSMiddleware, allow_origins=["https://example.test"], allow_credentials=True)\n',
    },
    { rule: 'debug-enabled', source: 'app = FastAPI(debug=True)\n', fixed: 'app = FastAPI(debug=False)\n' },
] as const;

export const NEXT_CONFIG_CASES = [
    {
        name: 'keys after a nested env value',
        source: `export default {
  env: {
    NESTED: { API_TOKEN: "nested text" },
    "API_SECRET": process.env.API_SECRET,
    ["PASSWORD"]: process.env.PASSWORD,
    TOKEN,
  },
  typescript: { ["ignoreBuildErrors"]: (true as const) },
};
`,
        expected: [
            {
                file: 'next.config.ts',
                line: 4,
                rule: 'gspot.nextjs.env-secret',
                message: '"API_SECRET" under env is written into the client bundle. Read it on the server.',
            },
            {
                file: 'next.config.ts',
                line: 5,
                rule: 'gspot.nextjs.env-secret',
                message: '"PASSWORD" under env is written into the client bundle. Read it on the server.',
            },
            {
                file: 'next.config.ts',
                line: 6,
                rule: 'gspot.nextjs.env-secret',
                message: 'TOKEN under env is written into the client bundle. Read it on the server.',
            },
            {
                file: 'next.config.ts',
                line: 8,
                rule: 'gspot.nextjs.checks-off',
                message: '"ignoreBuildErrors" true lets next build pass with errors. Remove it.',
            },
        ],
    },
    {
        name: 'quoted and asserted literal disabled checks',
        source: `export default {
  eslint: { "ignoreDuringBuilds": true satisfies boolean },
  typescript: { ignoreBuildErrors: <boolean>true },
};
`,
        expected: [
            {
                file: 'next.config.ts',
                line: 2,
                rule: 'gspot.nextjs.checks-off',
                message: '"ignoreDuringBuilds" true lets next build pass with errors. Remove it.',
            },
            {
                file: 'next.config.ts',
                line: 3,
                rule: 'gspot.nextjs.checks-off',
                message: 'ignoreBuildErrors true lets next build pass with errors. Remove it.',
            },
        ],
    },
    {
        name: 'comments, strings, false flags, and nested env values',
        source: `// env: { API_SECRET: "comment" }
const text = "ignoreBuildErrors: true";
export default {
  env: { SETTINGS: { API_TOKEN: text }, PUBLIC_ENDPOINT: "https://example.com" },
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: enabled },
};
`,
        expected: [],
    },
] as const;

export const SWIFT_SAMPLE = `let access = kSecAttrAccessibleAlways
let hash = Insecure.MD5
let background = kSecAttrAccessibleAfterFirstUnlock
`;

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

export const PLATFORM_SOURCES = {
    'supabase/functions/body/index.ts': `schema.parse(await req.json());
schema.safeParse(await req.json());
const body = await req.json();
const second = await req.json();
schema.parseAsync(await req.json());
schema.safeParseAsync(await req.json());
`,
    'src/html.js': `list.innerHTML = "";
list.innerHTML = "<li>None</li>";
list.innerHTML = name;
list.outerHTML = markup;
`,
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
    { file: 'supabase/functions/body/index.ts', rule: 'gspot.supabase.edge-unvalidated-json-body', line: 3 },
    { file: 'supabase/functions/body/index.ts', rule: 'gspot.supabase.edge-unvalidated-json-body', line: 4 },
    { file: 'src/html.js', rule: 'gspot.javascript.dom-html-sink', line: 3 },
    { file: 'src/html.js', rule: 'gspot.javascript.dom-html-sink', line: 4 },
    { file: 'functions/input.js', rule: 'gspot.javascript.ssrf-web-request-user-input', line: 1 },
    { file: 'Info.plist', rule: 'arbitrary-loads', line: 1 },
    { file: 'scripts/inject.js', rule: 'gspot.javascript.interpolated-exec', line: 1 },
    { file: 'src/filter.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'src/list.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'src/search.js', rule: 'gspot.supabase.postgrest-filter-interpolation', line: 1 },
    { file: 'supabase/functions/cors/index.ts', rule: 'gspot.supabase.edge-cors-wildcard-with-credentials', line: 1 },
] as const;

export const PLATFORM_SOURCE_FIXES = {
    'supabase/functions/body/index.ts': `schema.parse(await req.json());
schema.safeParse(await req.json());
const body = schema.parse(await req.json());
const second = schema.safeParse(await req.json());
schema.parseAsync(await req.json());
schema.safeParseAsync(await req.json());
`,
    'src/html.js': `list.innerHTML = "";
list.innerHTML = "<li>None</li>";
list.textContent = name;
list.textContent = markup;
`,
    'Info.plist': '<plist><dict/></plist>\n',
    'scripts/inject.js': 'execFileSync("printf", [input]);\n',
    'functions/input.js': 'fetch("https://example.com/api");\n',
    'src/filter.js': 'client.from("users").eq("id", input);\n',
    'src/list.js': 'client.from("users").in("id", input);\n',
    'src/search.js': 'client.from("docs").textSearch("body", `${term}`, { type: "plain" });\n',
    'supabase/functions/cors/index.ts':
        'export const headers = { "Access-Control-Allow-Origin": "https://example.com", "Access-Control-Allow-Credentials": "true" };\n',
} as const;

export const REPOSITORY_RULE = `rules:
    - id: test-no-double
      pattern: double(...)
      message: The test rule of the repository fires here.
      languages: [typescript]
      severity: ERROR
`;

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

export const MALFORMED_SEMGREP_RESULTS = [
    {
        check: 'security/semgrep',
        status: 'failed',
        findings: [{ file: 'scripts/café build.sh', line: 1, column: 1, rule: 'parse-error' }],
    },
] as const;

export const SECRET_LOG_FILES = ['supabase/functions/source.js', 'child/source.js'] as const;
