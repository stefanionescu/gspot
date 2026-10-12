export const EXPRESS_SCOPE_SETTINGS = `[[ignore]]
check = "security/semgrep"
paths = ["app/**/ignored.js"]
reason = "Generated samples are checked by their producer."
[[scope]]
path = "app"

configurations = ["express"]
[[scope]]
path = "app/child"

[[scope]]
path = "sibling"

`;

/** Express project evidence and inherited source paths for the scoped security test. */
export const EXPRESS_SCOPE_FILES = {
    'app/package.json': '{"name":"security-app","private":true,"dependencies":{"express":"5.2.1"}}',
    'source.js': 'res.send(req.body.message);\n',
    'app/source.js': 'res.send(req.body.message);\n',
    'app/child/source.js': 'res.send(req.body.message);\n',
    'sibling/source.js': 'res.send(req.body.message);\n',
    'app/ignored.js': 'eval(input);\n',
    'app/child/ignored.js': 'eval(input);\n',
    'sibling/ignored.js': 'eval(input);\n',
} as const;

/** Samples and positive source cases run together under the shipped Express pack. */
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

/** Exact source ownership for the three findings in inherited framework scopes. */
export const EXPRESS_SCOPE_FINDINGS = [
    { scope: 'app', file: 'app/source.js', line: 1, rule: 'gspot.express.res-send-raw-input' },
    { scope: 'app/child', file: 'app/child/source.js', line: 1, rule: 'gspot.express.res-send-raw-input' },
] as const;
