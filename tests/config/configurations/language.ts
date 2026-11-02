export const IMPLICIT_RETURNS_IGNORE =
    '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n';

export const REFERENCE_BUILD_FILES = {
    '.gitignore': 'node_modules/\n.venv/\n.gspot/\n',
    'package.json': '{"private":true,"type":"module"}\n',
    'config/base.json':
        '{"compilerOptions":{"composite":true,"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[],"baseUrl":"..","paths":{"@lib/*":["lib/*.d.ts"]}}}',
    'app/src/main.ts': 'import type { Value } from "@lib/value"; export const port: Value = "wrong";\n',
    'lib/value.d.ts': 'export type Value = number;\n',
    'neighbor/tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]},"include":["*.ts"]}',
    'neighbor/source.ts': 'export const ignored: number = "wrong";\n',
    'neighbor/node_modules/unrelated/package.json': '{"name":"unrelated","version":"1.0.0"}',
    'neighbor/.venv/pyvenv.cfg': 'home = unrelated\n',
} as const;

export const REFERENCE_BUILD_RESULTS = [
    { scope: '', status: 'passed' as const, findings: [] },
    { scope: 'app', status: 'failed' as const, findings: [{ file: 'app/src/main.ts', rule: 'TS2322' }] },
    { scope: 'neighbor', status: 'failed' as const, findings: [{ file: 'neighbor/source.ts', rule: 'TS2322' }] },
];

export const URL_MARKUP_CASES = [
    { markup: '<a href="javascript:alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href="java&#9;script:alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', scheme: 'vbscript:', columns: [4] },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', scheme: 'data:', columns: [4] },
    { markup: '<iframe src="data:text/html,example"></iframe>', scheme: 'data:', columns: [9] },
    { markup: '<object data="data:image/svg+xml,example"></object>', scheme: 'data:', columns: [9] },
    { markup: '<script src="data:text/javascript,alert(1)"></script>', scheme: 'data:', columns: [9] },
    { markup: '<a href="/page">Link</a><script src="/app.js"></script>', scheme: '', columns: [] },
    { markup: '<a href="/page" title="javascript: is a scheme">Link</a>', scheme: '', columns: [] },
    { markup: '<img src="data:image/png;base64,aW1hZ2U=" alt="Image">', scheme: '', columns: [] },
    { markup: '<img src="data:image/svg+xml,example" alt="Image">', scheme: '', columns: [] },
    { markup: '<a href="data:text/plain,example" download>Download</a>', scheme: '', columns: [] },
    { markup: '<script type="application/ld+json">{"name":"example"}</script>', scheme: '', columns: [] },
] as const;

export const INLINE_SCRIPT_PAGE = `<!doctype html>
<html lang="en">
<head><title>Shop</title></head>
<body>
<script>window.start();</script>
<button onclick="start()">Start</button>
<script type="application/json">{"name":"shop"}</script>
<script src="app.js"></script>
</body>
</html>
`;

export const SCRIPT_TYPE_CASES = [
    { type: 'text&#x2F;javascript', rules: ['inline-script', 'script-link'] },
    { type: 'text/plain', rules: [] },
    { type: '', rules: ['inline-script', 'script-link'] },
    { type: 'module', rules: ['inline-script', 'script-link'] },
    { type: ' Text/JavaScript ', rules: ['inline-script', 'script-link'] },
] as const;

export const MARKDOWN_FENCE_CASES = [
    {
        name: 'a YAML fence beside one that parses',
        markdown: '```yaml\nvalue: [\n```\n\n```yaml\nvalue: accepted\n```\n',
        lines: [2],
    },
    {
        name: 'TSX and JSONC alongside invalid JSON',
        markdown: `\`\`\`tsx
export const panel = <div>Hello</div>;
\`\`\`

\`\`\`jsonc
{ // accepted comment
 "enabled": true,
}
\`\`\`

\`\`\`json
{ // rejected comment
 "enabled": true
}
\`\`\`
`,
        lines: [12],
    },
    {
        name: 'JSON and TOML',
        markdown: `\`\`\`json
{"a": 1}
\`\`\`

\`\`\`json
{oops
\`\`\`

\`\`\`toml
key =
\`\`\`

\`\`\`ts
const a: number = 1;
\`\`\`

\`\`\`text
not code {
\`\`\`
`,
        lines: [6, 10],
    },
    {
        name: 'tilde and unclosed fences',
        markdown: `> ~~~json
> {oops
> ~~~~

\`\`\`json
{oops
`,
        lines: [2, 6],
    },
    { name: 'unclosed TSX', markdown: '```tsx\nexport const panel = <div>Hello;\n```', lines: [2] },
    { name: 'fixed JSX', markdown: '```jsx\nexport const panel = <div>Hello</div>;\n```', lines: [] },
    {
        name: 'a Bash fence that does not parse',
        markdown: '```bash\nif then\n```\n',
        lines: [2],
    },
    {
        name: 'a Bash fence that parses',
        markdown: '```bash\nprintf "%s\\n" "Hello"\n```\n',
        lines: [],
    },
] as const;

export const ROOT_PORT_SOURCE = 'export const port = 8080;\n';

export const CHILD_PORT_SOURCE = 'export const port = 3000;\n';

export const TSCONFIG_READ_ERRORS = [
    {
        name: 'malformed JSON',
        tsconfig: '{',
        error: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
        fixed: 'tsconfig.json',
    },
    {
        name: 'a missing inherited configuration',
        tsconfig: '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
        error: "Cannot read the compiler settings in tsconfig.json: Cannot read file '{root}/missing.json'.",
        fixed: 'missing.json',
    },
] as const;

export const DEFAULT_LEVEL_TSCONFIG = {
    compilerOptions: {
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitOverride: true,
        noFallthroughCasesInSwitch: true,
    },
} as const;

export const STRICT_OFF_FINDINGS = [
    {
        file: 'tsconfig.json',
        rule: 'strict',
    },
] as const;

export const ALL_LEVEL_OPTION_FINDINGS = [
    { file: 'tsconfig.json', rule: 'noImplicitReturns', message: 'noImplicitReturns is not on in this tsconfig.' },
    {
        file: 'tsconfig.json',
        rule: 'noPropertyAccessFromIndexSignature',
        message: 'noPropertyAccessFromIndexSignature is not on in this tsconfig.',
    },
] as const;

export const MISSING_TSCONFIG_MESSAGE =
    'Add a tsconfig.json to this scope. ESLint and tsc read the TypeScript files through it.';

export const COUNT_NUMBER_SOURCE = 'export const count: number = 1;\n';
