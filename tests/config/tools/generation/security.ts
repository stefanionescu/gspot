/** Each scope keeps the same unsafe source while dependency and framework selection change. */
export const SECURITY_SOURCE = `jwt.verify(token, secret);
jwt.decode(token);
res.json({ stack: error.stack });
fetch(req.query.url);
fetch(new URL(request.url).searchParams.get("target"));
console.error(process.env.API_TOKEN);
logger.warn(Deno.env.get("API_SECRET"));
`;

/** Documented forms keep signatures, hosts, response data, and secrets private. */
export const SECURITY_CORRECTION = `jwt.verify(token, secret, { algorithms: ["HS256"] });
res.json({ message: "Unable to load the record" });
fetch("https://example.com/status");
console.error("Unable to load the record");
`;

export const SECURITY_FILES = {
    'package.json': '{"private":true}',
    'source.js': SECURITY_SOURCE,
    'app/package.json': '{"private":true,"dependencies":{"express":"5.2.1","jsonwebtoken":"9.0.2"}}',
    'app/source.js': SECURITY_SOURCE,
    'app/child/source.js': SECURITY_SOURCE,
    'sibling/package.json': '{"private":true}',
    'sibling/source.js': SECURITY_SOURCE,
};

export const SECURITY_SCOPE_POLICY = `[scope."app"]
configurations = ["express"]
[scope."app/child"]
[scope."sibling"]
`;

export const SECURITY_FINDINGS = [
    { line: 1, rule: 'gspot.javascript.jwt-no-algorithm-none' },
    { line: 2, rule: 'gspot.javascript.jwt-no-decode-without-verify' },
    { line: 3, rule: 'gspot.express.no-stack-trace-in-response' },
    { line: 4, rule: 'gspot.javascript.ssrf-web-request-user-input' },
    { line: 5, rule: 'gspot.javascript.ssrf-web-request-user-input' },
    { line: 6, rule: 'gspot.javascript.no-secret-in-log' },
    { line: 7, rule: 'gspot.javascript.no-secret-in-log' },
];

export const SUPABASE_SOURCE = 'console.log(Deno.env.get("API_SECRET"));\n';
export const SUPABASE_CORRECTION = 'console.log("Unable to load the record");\n';
export const SUPABASE_SCOPE_POLICY = '[scope."child"]\n';
export const SUPABASE_SOURCE_PATHS = ['supabase/functions/source.js', 'child/source.js'];
