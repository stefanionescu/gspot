/** Native Markdown inputs exercise root and scoped configuration discovery without extra tool installation. */
export const FILES = {
    'root.md': '# Root\n\n## Notes\n\nRoot label.\n\n![](diagram.png)\n',
    'app/guide.md': '# Guide\n\n## Notes\n\nNested label.\n',
    'title.md': 'A document without a title.\n',
    'long.md':
        '# Long\n\nLong prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter. Long prose stays with the formatter.\n\n<span>Inline HTML stays permitted.</span>\n\n| Name | Value |\n| ---- | ----- |\n| A    | B     |\n',
};

/** Options for inactive rules must not enable them; scope options replace their own rule's values only. */
export const TABLES = `runner = "mise"
[agent_rules]
enabled = false
[format]
indent_width = 6
[tools.markdownlint.rules]
MD044 = { names = ["Root label"], code_blocks = false }
MD041 = {}
MD013 = { line_length = 10 }
MD033 = {}
MD060 = { style = "aligned" }
[scope."app"]
configurations = []
[scope."app".tools.markdownlint.rules]
MD044 = { names = ["Nested label"] }
`;

/** A table with columns that match none of the native Markdown styles. */
export const TABLE_COLUMN_SAMPLE = '# Table\n\n| Name | Value |\n| --- | --- |\n| A  | B |\n';
