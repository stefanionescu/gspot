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
key =\u0020
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
    { name: 'unclosed JSX', markdown: '```jsx\nexport const panel = <div>Hello;\n```', lines: [2] },
    { name: 'fixed TSX', markdown: '```tsx\nexport const panel = <div>Hello</div>;\n```', lines: [] },
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
