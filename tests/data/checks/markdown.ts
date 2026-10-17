import { GUIDE, README, LICENSE } from '#tests/data/checks/docs.ts';

export const MARKDOWNLINT_EXECUTABLE = '.gspot/node_modules/.bin/markdownlint-cli2';

/** Native Markdown inputs exercise root and scoped configuration discovery without extra tool installation. */
export const MARKDOWN_FILES = {
    'root.md': `# Root

## Notes

Root label.

![](diagram.png)
`,
    'app/guide.md': `# Guide

## Notes

Nested label.
`,
    'title.md': 'A document without a title.\n',
    'long.md': `# Long

Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter.

<span>Inline HTML stays permitted.</span>

| Name | Value |
| ---- | ----- |
| A    | B     |
`,
} as const;

/** Options for inactive rules must not enable them; scope options replace their own rule's values only. */
export const MARKDOWNLINT_SETTINGS = `[format]\nindent_width = 6\n[tools.markdownlint.rules]\nMD044 = { names = ["Root label"], code_blocks = false }\nMD041 = {}\nMD013 = { line_length = 10 }\nMD033 = {}\nMD060 = { style = "aligned" }\n[[scope]]\npath = "app"\n\nconfigurations = []\n[scope.tools.markdownlint.rules]\nMD044 = { names = ["Nested label"] }\n`;

/** A table with columns that match none of the native Markdown styles. */
export const TABLE_COLUMN_SAMPLE = `# Table

| Name | Value |
| --- | --- |
| A  | B |
`;

export const MARKDOWN_FENCE_CASES = [
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
] as const;

export const MARKDOWN_SANDBOX = {
    configurations: ['markdown'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;
