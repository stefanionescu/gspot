export const APP_SEMGREP =
    '[agent_rules]\nenabled = false\n[[scope]]\npath = "app"\nconfigurations = ["express"]\n[scope.tools.semgrep]\nexclude = [{ paths = ["app/**/ignored.js"], reason = "Generated fixtures are checked by their producer." }]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n';

/** Express project evidence and inherited source paths for the scoped security test. */
export const FRAMEWORK_FILES = {
    'app/package.json': '{"name":"security-app","private":true,"dependencies":{"express":"5.2.1"}}',
    'source.js': 'res.send(req.body.message);\n',
    'app/source.js': 'res.send(req.body.message);\n',
    'app/child/source.js': 'res.send(req.body.message);\n',
    'sibling/source.js': 'res.send(req.body.message);\n',
    'app/ignored.js': 'eval(input);\n',
    'app/child/ignored.js': 'eval(input);\n',
    'sibling/ignored.js': 'eval(input);\n',
};

// One Swift rule of each level, after the Bash rules the bash configuration adds.
export const SWIFT_DEFECTS = 'let access = kSecAttrAccessibleAlways\nlet pointer = UnsafeRawPointer(value)\n';

/** Defects and positive source cases run together under the shipped Express pack. */
export const EXPRESS_SOURCE_CASES = {
    'logger.js': 'logger.info(`User ${req.query.name}`);\n',
    'json.js': 'res.json({ name: req.query.name });\n',
    'query-object.js': 'res.send(req.query);\n',
    'parameterized.js': 'db.query("SELECT * FROM users WHERE id = $1", [req.query.id]);\n',
    'field.js': 'res.send(req.query.name);\n',
    'response-template.js': 'res.send(`<p>${req.query.name}</p>`);\n',
    'query-template.js': 'db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n',
    'execute-template.js': 'db.execute(`DELETE FROM users WHERE id = ${req.params.id}`);\n',
};

export const EXPRESS_SOURCE_FINDINGS = [
    { file: 'execute-template.js', rule: 'express-raw-query-interpolation', line: 1 },
    { file: 'field.js', rule: 'express-res-send-raw-input', line: 1 },
    { file: 'query-template.js', rule: 'express-raw-query-interpolation', line: 1 },
    { file: 'response-template.js', rule: 'express-res-send-raw-input', line: 1 },
];

/** Exact source ownership for the three findings in inherited framework scopes. */
export const FRAMEWORK_FINDINGS = [
    { scope: 'app', file: 'app/source.js', line: 1, rule: 'express-res-send-raw-input' },
    { scope: 'app/child', file: 'app/child/source.js', line: 1, rule: 'express-res-send-raw-input' },
    { scope: 'sibling', file: 'sibling/ignored.js', line: 1, rule: 'node-no-eval' },
];

/** An exception response whose correction keeps its cause private. */
export const FASTAPI_SOURCE = `from fastapi import HTTPException

def lookup():
    try:
        return load_user()
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
`;

/** Project evidence that keeps every selected security configuration after apply. */
export const SEMGREP_PROJECT_FILES = {
    'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"express":"5.2.1"}}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["fastapi"]\n',
    'src/index.ts': 'export const answer = 42;\n',
    'script.sh': '#!/usr/bin/env bash\nprintf "%s\\n" "Ready"\n',
    'Value.swift': 'let answer = 42\n',
    'wrangler.toml': 'name = "example"\ncompatibility_date = "2026-01-01"\n',
    'supabase/config.toml': 'project_id = "example"\n',
};
