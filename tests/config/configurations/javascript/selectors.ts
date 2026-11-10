export const JAVASCRIPT_SELECTOR_FILES = {
    'html.js': `list.innerHTML = "";
list.innerHTML = "<li>None</li>";
list.innerHTML = name;
list.outerHTML = markup;
list.insertAdjacentHTML("beforeend", markup);
document.write(markup);
list.textContent = markup;
`,
    'request.js': `fetch(new URL(request.url).searchParams.get("target"));
fetch(req.query.target);
fetch(context.request.url, { cf: { cacheTtl: 5 } });
fetch("https://example.com/api");
`,
    'log.js': `console.info(process.env.API_TOKEN);
auditLogger.warn(process.env.API_SECRET);
this.logger.error(process.env.PASSWORD);
applicationLog.trace(process.env.CREDENTIAL);
console.log(Deno.env.get("API_SECRET"));
console.info(process.env.PORT);
storage.write(process.env.API_TOKEN);
logger.info("Token refreshed");
`,
    'exec.js': `execSync(\`printf \${input}\`);
exec(\`ls \${folder}\`);
execFileSync("printf", [input]);
`,
} as const;

export const JAVASCRIPT_SELECTOR_FINDINGS = {
    'exec.js': [1, 2],
    'html.js': [3, 4, 5, 6],
    'log.js': [1, 2, 3, 4, 5],
    'request.js': [1, 2],
} as const;

export const JWT_SCOPE_FILES = {
    'package.json': '{"private":true}',
    'source.js': 'jwt.decode(token);\n',
    'jwt/package.json': '{"private":true,"dependencies":{"jsonwebtoken":"9.0.2"}}',
    'jwt/source.js': `jwt.verify(token, key);
jwt.verify(token, key, { algorithms: ["RS256"] });
jwt.verify(token, key, { issuer });
jwt.decode(token);
`,
    'jwt/child/source.js': 'jwt.decode(token);\n',
    'other/package.json': '{"private":true}',
    'other/source.js': 'jwt.decode(token);\n',
} as const;

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
    'source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
    'app/source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
    'app/child/source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
    'sibling/source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
} as const;

export const EXPRESS_SOURCES = {
    'json.js': 'res.json({ name: req.query.name });\n',
    'parameterized.js': 'db.query("SELECT * FROM users WHERE id = $1", [req.query.id]);\n',
    'query-template.js': 'db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n',
    'execute-template.js': 'db.execute(`DELETE FROM users WHERE id = ${req.params.id}`);\n',
    'stack.js': 'res.json({ stack: error.stack });\nres.status(500).send({ stack: error.stack });\n',
    'failure.js': 'res.json({ error: "Request failed" });\n',
    'client-message.js': 'res.json({ message: `Item ${identifier}` });\n',
} as const;

export const EXPRESS_SOURCE_FINDINGS = [
    { file: 'client-message.js', line: 1 },
    { file: 'execute-template.js', line: 1 },
    { file: 'query-template.js', line: 1 },
    { file: 'stack.js', line: 1 },
    { file: 'stack.js', line: 2 },
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
        expected: [4, 5, 6, 8],
    },
    {
        name: 'quoted and asserted literal disabled checks',
        source: `export default {
  eslint: { "ignoreDuringBuilds": true satisfies boolean },
  typescript: { ignoreBuildErrors: <boolean>true },
};
`,
        expected: [2, 3],
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

export const PLATFORM_SOURCES = {
    'functions/headers.js': 'response.headers.set("Access-Control-Allow-Origin", "*");\n',
    'functions/named.js': 'response.headers.set("Access-Control-Allow-Origin", "https://example.com");\n',
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

export const PLATFORM_FINDINGS = [
    { file: 'functions/headers.js', line: 1 },
    { file: 'src/filter.js', line: 1 },
    { file: 'src/list.js', line: 1 },
    { file: 'src/search.js', line: 1 },
    { file: 'supabase/functions/_shared/cors.ts', line: 1 },
    { file: 'supabase/functions/cors/index.ts', line: 1 },
    { file: 'supabase/functions/cors/index.ts', line: 1 },
] as const;

export const SUPABASE_FOLDER_SETTINGS = `[[scope]]
path = "api"
configurations = ["supabase"]

[scope.supabase]
functions_folder = "edge"

[[scope]]
path = "sibling"
`;

export const SUPABASE_FOLDER_FILES = Object.fromEntries(
    ['api/edge/cors.js', 'api/other/cors.js', 'sibling/edge/cors.js'].map((path) => [
        path,
        'export const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" };\n',
    ]),
);
