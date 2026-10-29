import { TYPO } from '#tests/config/spelling.ts';

export const STYLE_CASES = [
    {
        rule: 'em-dashes',
        path: 'directives.md',
        source: '# Guide\n\nA sentence -- with punctuation.\n\nUse `// eslint-disable-next-line no-console -- reason: the command prints its result`.\n\nUse `value -- item`.\n\n```javascript\n// eslint-disable-next-line no-console -- reason: the command prints its result\n```\n',
        findings: [
            {
                line: 3,
                rule: 'gspot.em-dashes',
                message: 'Em dash or double hyphen. Use a comma, colon, or period.',
            },
        ],
    },
    {
        path: 'prices.md',
        source: '# Prices\n\nThe price is $5.00.\n\nThe price is $15.\n\nThe price is 5 dollars.\n\nThe price is USD 5.\n',
        rule: 'currency',
        findings: [
            { line: 3, rule: 'gspot.currency', message: "Ambiguous currency '$5.00'. Write the ISO code (USD 5)." },
            { line: 5, rule: 'gspot.currency', message: "Ambiguous currency '$15'. Write the ISO code (USD 5)." },
            { line: 7, rule: 'gspot.currency', message: "Ambiguous currency '5 dollars'. Write the ISO code (USD 5)." },
        ],
    },
    {
        rule: 'en-dashes',
        path: 'ranges.md',
        source: `# Guide

Read pages 3–5.

Read pages 3 to 5.
`,
        findings: [
            {
                line: 3,
                rule: 'gspot.en-dashes',
                message: "En dash '\u{2013}'. Write 'to' for a range, or use a hyphen in a compound.",
            },
        ],
    },
    {
        rule: 'acronyms',
        path: 'instructions.md',
        source: `# Guide

Read CLAUDE.md and AGENTS.md before RGBA colors.

- \`.gspot/configurations/language/javascript/rules/BUN.md\`: when code runs on Bun.
`,
        findings: [{ line: 3, rule: 'gspot.acronyms', message: "Spell out 'RGBA' on first use." }],
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
        findings: [],
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
        findings: [
            {
                line: 7,
                rule: 'gspot.tree-blocks',
                message:
                    'A file tree inventories the layout and goes stale with each move. Document behavior and ownership instead.',
            },
        ],
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
        findings: [
            {
                line: 3,
                rule: 'gspot.file-paths',
                message:
                    "A file path in prose goes stale: 'src/view.tsx'. Name the concept, or put the path in code formatting only where the reader must open it.",
            },
            {
                line: 5,
                rule: 'gspot.file-paths',
                message:
                    "A file path in prose goes stale: 'src/site.css'. Name the concept, or put the path in code formatting only where the reader must open it.",
            },
            {
                line: 7,
                rule: 'gspot.file-paths',
                message:
                    "A file path in prose goes stale: 'src/lib.go'. Name the concept, or put the path in code formatting only where the reader must open it.",
            },
            {
                line: 9,
                rule: 'gspot.file-paths',
                message:
                    "A file path in prose goes stale: 'src/lib.rs'. Name the concept, or put the path in code formatting only where the reader must open it.",
            },
        ],
    },
    {
        rule: 'since',
        path: 'since.md',
        source: `# Guide

The @since tag names the first release.

Use cached values since the source is stable.
`,
        findings: [
            {
                line: 5,
                rule: 'gspot.since',
                message: "'since' is ambiguous between time and cause. Use 'because' or 'after'.",
            },
        ],
    },
    {
        rule: 'future',
        path: 'future.md',
        source: `# Guide

The feature will be added.

A todo app lists tasks.

Use TODO to label work.
`,
        findings: [{ line: 3, rule: 'gspot.future', message: "Future promise 'will be added'. Document what exists." }],
    },
    {
        rule: 'placeholders',
        path: 'parameters.md',
        source: `# Guide

Supply YOUR_TOKEN.

Supply {{token}}.

Use <api-token> in the command.
`,
        findings: [
            {
                line: 3,
                rule: 'gspot.placeholders',
                message: "Placeholder style 'YOUR_TOKEN'. Use <kebab-case> in angle brackets.",
            },
            {
                line: 5,
                rule: 'gspot.placeholders',
                message: "Placeholder style '{{token}}'. Use <kebab-case> in angle brackets.",
            },
        ],
    },
] as const;

export const CORRECTED_LINK_TEXT_GUIDE = `# Guide

Read [request guide](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`;

export const LINK_TEXT_GUIDE = `# Guide

Read [here](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`;

export const HEADING_CASE_GUIDE = `# Guide

## HTTP request rules

## Microsoft Edge settings

## HTTP Request Rules
`;

export const SUPPRESSION_COMMENTS = [
    '// eslint-disable -- reason: The external declaration requires this signature.',
    '// eslint-enable no-x, @scope/no-y -- reason: Checks resume here.',
    '// eslint-disable-line no-x -- reason: The external declaration requires this signature.',
    '// eslint-disable-next-line no-x -- reason: The vendor declaration fixes this signature.',
    '// Punctuation -- stays checked.',
    'const value = 1; // eslint-disable-line no-x -- reason: The vendor declaration fixes this signature.',
    '',
] as const;

export const VOCABULARY_SOURCE = `# Guide

Use sqlfluff and NebulaProduct.

Use ${TYPO.receive}.

Avoid vale's and ajv's.
`;

export const VERSION_RANGE_SOURCE = [
    'Use Node.js 24.2.0 or later.',
    'Use Git 2.40 or newer.',
    'Use version 3 or higher.',
    'Use version 3.x.',
    'Use version 3+ or later.',
    'Use the current version or newer.',
    'Use version 1.2.0-beta.1 or later.',
    'Use version 3.2.0  or newer.',
    'Use version 3.2.0\nor later.',
    '',
].join('\n');

export const ALT_TEXT_CASES = [
    { tag: '<img title="no alt=here" src="a.png">', missing: true },
    { tag: '<img src="a.png">', missing: true },
    { tag: '<img data-alt="x" src="a.png">', missing: true },
    { tag: '<img alt="A cat" src="a.png">', missing: false },
    { tag: '<img alt src="a.png">', missing: false },
    { tag: '<img alt="" src="a.png">', missing: false },
    { tag: '<img src="a.png" alt="x" />', missing: false },
    { tag: '<img src=a.png alt>', missing: false },
] as const;
