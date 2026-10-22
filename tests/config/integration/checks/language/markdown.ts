import { GUIDE, README, LICENSE } from '#tests/config/checks/samples.ts';

export const MARKDOWNLINT_EXECUTABLE = '.gspot/node_modules/.bin/markdownlint-cli2';

/** Markdown files in the root and a scope, to test which config file applies, with no extra tools to install. */
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

export const MDX_FILES = {
    'policy.mdx': `import { Notice } from './notice';
import Updated from './updated';

export const metadata = {
    description: 'How the shop keeps your data.',
};

# Privacy

The shop keeps your order history.
`,
    'untitled.mdx': `import { Notice } from './notice';

The page has no heading.
`,
} as const;

/** Options of an inactive rule do not turn it on; scope options replace only the values of their own rule. */
export const MARKDOWNLINT_TABLES = `[format]\nindent_width = 6\n[tools.markdownlint.rules]\nMD044 = { names = ["Root label"], code_blocks = false }\nMD041 = {}\nMD013 = { line_length = 10 }\nMD033 = {}\nMD060 = { style = "aligned" }\n[[scope]]\npath = "app"\n\nconfigurations = []\n[scope.tools.markdownlint.rules]\nMD044 = { names = ["Nested label"] }\n`;

export const MARKDOWN_SANDBOX = {
    configurations: ['markdown'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;
