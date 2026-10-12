import { TYPO, TYPO_REPORT } from '#tests/config/spelling.ts';
import { GUIDE, README, LICENSE } from '#tests/config/docs.ts';

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

export const MARKDOWN_REPORT = {
    fileName: 'sample.md',
    lineNumber: 1,
    ruleNames: ['MD033'],
    ruleDescription: 'Inline HTML',
    errorDetail: 'Element: span',
    errorContext: null,
    errorRange: [1, 6],
    fixInfo: null,
    severity: 'error',
} as const;

export const REPORT_ERRORS = [
    {
        configuration: 'markdown',
        name: 'empty report',
        output: '',
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'non-JSON text',
        output: 'not JSON',
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'non-array report',
        output: '{}',
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'empty rules',
        output: [{ ...MARKDOWN_REPORT, ruleNames: [] }],
        message: 'Markdownlint returned invalid structured findings.',
    },

    {
        configuration: 'markdown',
        name: 'invalid fix',
        output: [{ ...MARKDOWN_REPORT, fixInfo: [] }],
        message: 'Markdownlint returned invalid structured findings.',
    },

    {
        configuration: 'spelling',
        name: 'unfinished JSON',
        output: '{',
        message: 'Typos returned invalid structured findings.',
    },
    {
        configuration: 'spelling',
        name: 'partial typo',
        output: { type: 'typo', path: 'sample.txt', typo: TYPO.the },
        message: 'Typos returned invalid structured findings.',
    },
    {
        configuration: 'spelling',
        name: 'native error',
        output: { type: 'error', message: 'Read failed.' },
        message: 'Typos returned invalid structured findings.',
    },
    {
        configuration: 'spelling',
        name: 'escaping path',
        output: { ...TYPO_REPORT, path: '../outside.txt' },
        message: 'Cannot read reported source file ../outside.txt.',
    },
    {
        configuration: 'spelling',
        name: 'outside offset',
        output: { ...TYPO_REPORT, byte_offset: 99 },
        message: 'Typos reported a position outside the source: sample.txt',
    },
    {
        configuration: 'spelling',
        name: 'missing source',
        output: { ...TYPO_REPORT, path: 'missing.txt' },
        message: 'Cannot read reported source file missing.txt.',
    },
    {
        configuration: 'spelling',
        name: 'large offset',
        output: { ...TYPO_REPORT, byte_offset: 999 },
        message: 'Typos reported a position outside the source: sample.txt',
    },
] as const;

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

export const MARKDOWN_CASES = [
    {
        check: 'markdown/markdownlint',
        files: {
            'docs/image.md': `# A page

![](diagram.png)
`,
        },
        expected: { file: 'docs/image.md', line: 3, rule: 'MD045' },
        corrected: {
            files: {
                'docs/image.md': `# A page

![Request flow](diagram.png)
`,
            },
        },
    },
    {
        check: 'markdown/markdownlint',
        files: {
            'docs/titles.md': `# First title

# Second title
`,
        },
        expected: { file: 'docs/titles.md', line: 3, rule: 'MD025' },
        corrected: {
            files: {
                'docs/titles.md': `# First title

## Second heading
`,
            },
        },
    },
    {
        check: 'markdown/markdownlint',
        files: {
            'docs/skipped.md': `# A page

### A heading two levels down

Text under it.
`,
        },
        expected: { file: 'docs/skipped.md', rule: 'MD001', line: 3 },
        corrected: {
            files: {
                'docs/skipped.md': `# A page

## A heading

Text under it.
`,
            },
        },
    },
] as const;

export const MARKDOWN_SANDBOX = {
    configurations: ['markdown'],
    tools: ['markdownlint-cli2'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;
