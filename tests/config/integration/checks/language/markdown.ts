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

export const MARKDOWNLINT_TABLES = `[format]
indent_width = 6
[tools.markdownlint.rules]
MD044 = { names = ["Root label"], code_blocks = false }
MD060 = { style = "aligned" }
[[scope]]
path = "app"

configurations = []
[scope.tools.markdownlint.rules]
MD044 = { names = ["Nested label"] }
`;

export const TITLED_DOCUMENT = '# Title\n\nA document with a title.\n';
