/** Each style rule still checks prose and does not report source notation. */
export const STYLE_CASES = [
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
`,
        lines: [3],
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
        path: 'parameters.md',
        source: `# Guide

Supply YOUR_TOKEN.

Supply {{token}}.

Use <api-token> in the command.
`,
        lines: [3, 5],
    },
] as const;
