export const STYLE_CASES = [
    {
        path: 'prices.md',
        source: '# Prices\n\nThe price is $5.00.\n\nThe price is $15.\n\nThe price is 5 dollars.\n\nThe price is USD 5.\n',
        lines: [3, 5, 7],
        rule: 'currency',
    },
    {
        path: 'source.sh',
        source: '# Read $1 and $2 as positional parameters.\nprintf "%s" "$1"\n',
        lines: [],
        rule: 'currency',
    },
    {
        path: 'source.ts',
        source: '// Use $1 as the regular expression replacement.\nconst value = 1;\n',
        lines: [],
        rule: 'currency',
    },
    {
        rule: 'en-dashes',
        path: 'ranges.md',
        source: `# Guide

Read pages 3–5.

Read pages 3 to 5.
`,
        lines: [3],
    },
    {
        rule: 'acronyms',
        path: 'agents.md',
        source: `# Guide

Read CLAUDE.md and AGENTS.md before RGBA colors.

- \`.gspot/rules/BUN.md\`: when code runs on Bun.
`,
        lines: [3],
    },
    {
        rule: 'acronyms',
        path: 'fences.md',
        source: `# Guide

BUN.md holds the Bun rules.

\`\`\`bash
file_list="$(mktemp)" || exit 1
trap 'rm -f -- "\${file_list}"' EXIT
\`\`\`
`,
        lines: [],
    },
    {
        rule: 'acronyms',
        path: 'tags.ts',
        source: `/**
 * Holds the reply colors.
 * @property {RGBA} color the reply color.
 * @yields {CMYK} the next color.
 */
export const reply = {};
`,
        lines: [],
    },
    {
        rule: 'tree-blocks',
        path: 'tree.md',
        source: `# Guide

The app keeps its routes apart from its data.

\`\`\`text
src/
├── routes/
│   └── cart.ts
└── data/
\`\`\`
`,
        lines: [7],
    },
    {
        rule: 'tree-blocks',
        path: 'tree.ts',
        source: `// Prints the folders as a tree, such as:
// └── data/
export const branch = '└──';
`,
        lines: [],
    },
    {
        rule: 'file-paths',
        path: 'paths.md',
        source: `# Guide

Inspect src/view.tsx.

Inspect src/site.css.

Inspect src/lib.go.

Inspect src/lib.rs.

Use \`src/view.tsx\` in the command.
`,
        lines: [3, 5, 7, 9],
    },
    {
        rule: 'since',
        path: 'source.ts',
        source: `/**
 * @since 1.2.0
 */
// Use cached values since the source is stable.
const sinceValue = "since";
`,
        lines: [4],
    },
    {
        rule: 'future',
        path: 'future.md',
        source: `# Guide

The feature will be added.

A todo app lists tasks.

Use TODO to label work.
`,
        lines: [3],
    },
    {
        rule: 'placeholders',
        messages: [
            "Placeholder style 'YOUR_TOKEN'. Use <kebab-case> in angle brackets.",
            "Placeholder style '{{token}}'. Use <kebab-case> in angle brackets.",
        ],
        path: 'parameters.md',
        source: `# Guide

Supply YOUR_TOKEN.

Supply {{token}}.

Use <api-token> in the command.
`,
        lines: [3, 5],
    },
] as const;
