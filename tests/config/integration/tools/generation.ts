// The literal values integration/tools/generation reads: names, patterns, limits, and tables.

const FASTAPI_GUIDE_REQUESTS = `import json

from fastapi.testclient import TestClient

from example_0 import app as catalog
from example_1 import app as filters

results = []
with TestClient(catalog) as client:
    for path in ("/items/0", "/items/2"):
        response = client.get(path)
        results.append([response.status_code, response.json()])
    for path in ("/items/-1", "/items/invalid", "/docs", "/openapi.json"):
        results.append(client.get(path).status_code)
with TestClient(filters) as client:
    response = client.get("/filters?limit=2&offset=1&tags=paper&tags=wood")
    results.append([response.status_code, response.json()])
    for path in ("/filters?limit=101", "/filters?unexpected=value"):
        results.append(client.get(path).status_code)
    response = client.get("/filters")
    results.append([response.status_code, response.json()])
print(json.dumps(results))
`;

const FASTAPI_RUNTIME_REQUESTS = String.raw`import json

from fastapi.testclient import TestClient

from example_0 import MAX_UPLOAD_BYTES, app as uploads
from example_1 import app as streams

results = []
with TestClient(uploads) as client:
    for content in (b"", b"abc", b"x" * (MAX_UPLOAD_BYTES + 1)):
        response = client.post("/uploads", files={"upload": ("file.bin", content)})
        results.append([response.status_code, response.json()])
    results.append(client.post("/uploads").status_code)
with TestClient(streams) as client:
    response = client.get("/items")
    results.append([response.status_code, response.headers["content-type"],
                    [json.loads(line) for line in response.iter_lines()]])
    response = client.get("/events")
    events = []
    for block in response.text.replace("\r\n", "\n").strip().split("\n\n"):
        event = dict(line.split(": ", 1) for line in block.splitlines())
        event["data"] = json.loads(event["data"])
        events.append(event)
    results.append([response.status_code, response.headers["content-type"], events])
print(json.dumps(results))
`;

export const FASTAPI_GUIDE_TESTS = [
    {
        guide: 'FASTAPI',
        dependencies: ['fastapi>=0.115,<1', 'httpx>=0.28,<1'],
        program: FASTAPI_GUIDE_REQUESTS,
        responses: [
            [200, { name: 'Notebook' }],
            [404, { detail: 'Item not found' }],
            422,
            422,
            404,
            404,
            [200, { limit: 2, offset: 1, tags: ['paper', 'wood'] }],
            422,
            422,
            [200, { limit: 100, offset: 0, tags: [] }],
        ],
    },
    {
        guide: 'RUNTIME',
        dependencies: ['fastapi>=0.135,<1', 'httpx>=0.28,<1', 'python-multipart>=0.0.20,<1'],
        program: FASTAPI_RUNTIME_REQUESTS,
        responses: [
            [200, { size: 0 }],
            [200, { size: 3 }],
            [413, { detail: 'Upload exceeds one MiB' }],
            422,
            [200, 'application/jsonl', [{ name: 'Notebook' }, { name: 'Pencil' }]],
            [
                200,
                'text/event-stream; charset=utf-8',
                [
                    { id: '0', event: 'item', data: { name: 'Notebook' } },
                    { id: '1', event: 'item', data: { name: 'Pencil' } },
                ],
            ],
        ],
    },
];

export const SWIFT_DOCS_SOURCE =
    '/** Parses a fixture value. */\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n\n/// The literal /** example */ is documentation syntax.\npublic let example = "/** not documentation */"\n\n/* Ordinary comment with a nested /** comment */ inside. */\n';
export const DEFECT = 'public func parsed(_ value: String) -> Int {\n    Int(value)! + 42\n}\n';
export const CORRECT =
    '/// Parses a fixture value.\npublic func parsed(_ value: String) -> Int {\n    Int(value) ?? 0\n}\n';
export const SCRIPTS = 'eval(code);\nexecSync(`build ${input}`);\n';
export const PLIST =
    '<plist><dict><key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict></dict></plist>\n';
export const SWIFT_SECURITY_FINDINGS = [
    { rule: 'ios-keychain-accessible-always', path: 'Value.swift', line: 1, level: 'recommended' },
    { rule: 'ios-no-secrets-in-userdefaults', path: 'Value.swift', line: 2, level: 'recommended' },
    { rule: 'ios-no-secrets-in-plist', path: 'Value.swift', line: 3, level: 'recommended' },
    { rule: 'ios-hardcoded-api-key', path: 'Value.swift', line: 4, level: 'recommended' },
    { rule: 'ios-hardcoded-url-with-credentials', path: 'Value.swift', line: 5, level: 'recommended' },
    { rule: 'ios-insecure-http-url', path: 'Value.swift', line: 6, level: 'recommended' },
    { rule: 'ios-unsafe-pointer-cast', path: 'Value.swift', line: 7, level: 'all' },
    { rule: 'ios-weak-hash-algorithm', path: 'Value.swift', line: 8, level: 'recommended' },
    { rule: 'ios-no-uiwebview', path: 'Value.swift', line: 9, level: 'recommended' },
    { rule: 'ios-wkwebview-javascript-enabled', path: 'Value.swift', line: 10, level: 'all' },
    { rule: 'ios-log-sensitive-data', path: 'Value.swift', line: 11, level: 'recommended' },
    { rule: 'ios-no-ats-exception-in-plist', path: 'Info.plist', line: 1, level: 'recommended' },
    { rule: 'ios-scripts-no-eval', path: 'scripts/build.js', line: 1, level: 'recommended' },
    { rule: 'ios-scripts-no-unquoted-shell-var-in-exec', path: 'scripts/build.js', line: 2, level: 'recommended' },
];

export const SWIFT_SECURITY_ARGS = [
    'scan',
    '--config',
    '.gspot/config/semgrep/ios.yml',
    '--metrics',
    'off',
    '--disable-version-check',
    '--no-rewrite-rule-ids',
    '--error',
    '--json',
    'Value.swift',
    'scripts/build.js',
    'Info.plist',
];

export const SWIFT_INLINE_DOCS = [
    '/// A choice.',
    'public enum Choice {',
    '    /// The first choice.',
    '    case one /** Inline documentation. */',
    '}',
    '/// A literal.',
    'public let example = "/** literal */" /** After a string. */',
    '/* Ordinary comment. */ /** After a comment. */',
    '/// An inline /** example */ remains documentation.',
    'public let value = "safe"',
    '/* Ordinary /** nested */ comment. */',
    '// swiftlint:disable:next doc_comment_style - An external declaration retains its layout.',
    '/** A retained declaration. */',
    'public let preserved = "fixed"',
    '',
].join('\n');

export const JAVASCRIPT_AUTHORED_FILES = {
    'jsconfig.json': '{"extends":"./base.json"}\n',
    'base.json': JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            baseUrl: '.',
            paths: { '@shape/*': ['source/*'] },
            types: ['domain'],
            incremental: true,
            tsBuildInfoFile: 'authored/cache.tsbuildinfo',
        },
        include: ['source/**/*.js'],
        exclude: ['excluded'],
    }),
    'excluded/source.js': 'UnknownDependency();\n',
};
