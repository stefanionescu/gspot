import { STRICT_TYPE_FLAGS } from '#tests/config/setup/languages.ts';

// html
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
    { type: ' Text/JavaScript ', rules: ['inline-script', 'script-link'] },
] as const;
export const URL_MARKUP_CASES = [
    { markup: '<a href="jav&#x61;script&colon;alert(1)">Link</a>', scheme: 'javascript:', columns: [4] },
    { markup: '<a href=" VbScRiPt:msgbox(1)">Link</a>', scheme: 'vbscript:', columns: [4] },
    { markup: '<a href="data:text/html;base64,PHNjcmlwdD4=">Link</a>', scheme: 'data:', columns: [4] },
    { markup: '<object data="data:image/svg+xml,example"></object>', scheme: 'data:', columns: [9] },
    { markup: '<a href="/page" title="javascript: is a scheme">Link</a>', scheme: '', columns: [] },
    { markup: '<img src="data:image/svg+xml,example" alt="Image">', scheme: '', columns: [] },
    { markup: '<a href="data:text/plain,example" download>Download</a>', scheme: '', columns: [] },
] as const;

// markdown
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

\`\`\`toml
key =
\`\`\`

\`\`\`text
not code {
\`\`\`
`,
        lines: [6],
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
    {
        name: 'a Bash fence with placeholder arguments',
        markdown: '```bash\ncp <source> <target>\n```\n',
        lines: [],
    },
    {
        name: 'fragments: elided code, an object member, a call signature, and a type',
        markdown: `\`\`\`ts
const useStore = create((set) => ({
  // ...
\`\`\`

\`\`\`js
increment: () => set((state) => ({ count: state.count + 1 })),
\`\`\`

\`\`\`ts
useShallow<T, U = T>(selectorFn: (state: T) => U): (state: T) => U
\`\`\`

\`\`\`ts
{ count: number; increment: () => void }
\`\`\`

\`\`\`ts
const count = ;
\`\`\`
`,
        lines: [19],
    },
] as const;

// tsc
export const REFERENCE_BUILD_RESULTS = [
    { scope: '', status: 'passed' as const, findings: [] },
    { scope: 'app', status: 'failed' as const, findings: [{ file: 'app/src/main.ts', rule: 'TS2322' }] },
    { scope: 'neighbor', status: 'failed' as const, findings: [{ file: 'neighbor/source.ts', rule: 'TS18047' }] },
];

// typescript
export const ALL_LEVEL_OPTION_FINDINGS = [
    { file: 'tsconfig.json', rule: 'noImplicitReturns' },
    { file: 'tsconfig.json', rule: 'noPropertyAccessFromIndexSignature' },
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
export const STRICT_TSCONFIG_TEXT = JSON.stringify({ compilerOptions: STRICT_TYPE_FLAGS });
