import { TYPO } from '#tests/config/checks/general/spelling.ts';

/**
 * Prose samples for one gspot Vale rule each: the file, its source, and every finding Vale reports on it, which can come
 * from another gspot rule.
 */
export const STYLE_CASES = [
    {
        path: 'prices.md',
        source: '# Prices\n\nThe price is $5.00.\n\nThe price is $15.\n\nThe price is 5 dollars.\n\nThe price is USD 5.\n',
        rule: 'currency',
        findings: [
            { line: 3, rule: 'gspot.currency', message: "Ambiguous currency '$5.00'. Write the ISO code (USD 5)." },
            { line: 5, rule: 'gspot.currency', message: "Ambiguous currency '$15'. Write the ISO code (USD 5)." },
            { line: 7, rule: 'gspot.currency', message: "Ambiguous currency '5 dollars'. Write the ISO code (USD 5)." },
            { line: 9, rule: 'gspot.acronyms', message: "Spell out 'USD' on first use." },
        ],
    },
    {
        path: 'source.sh',
        source: '# Read $1 and $2 as positional parameters.\nprintf "%s" "$1"\n',
        rule: 'currency',
        findings: [],
    },
    {
        path: 'source.ts',
        source: '// Use $1 as the regular expression replacement.\nconst value = 1;\n',
        rule: 'currency',
        findings: [],
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
                message: "En dash '\u2013'. Write 'to' for a range, or use a hyphen in a compound.",
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
        rule: 'acronyms',
        path: 'tags.ts',
        source: `/**
 * Holds the reply colors.
 * @property {RGBA} color the reply color.
 * @yields {CMYK} the next color.
 */
export const reply = {};
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
        rule: 'tree-blocks',
        path: 'tree.ts',
        source: `// Prints the folders as a tree, such as:
// └── data/
export const branch = '└──';
`,
        findings: [],
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
        path: 'source.ts',
        source: `/**
 * @since 1.2.0
 */
// Use cached values since the source is stable.
const sinceValue = "since";
`,
        findings: [
            {
                line: 4,
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
        findings: [
            { line: 3, rule: 'gspot.future', message: "Future promise 'will be added'. Document what exists." },
            { line: 7, rule: 'gspot.acronyms', message: "Spell out 'TODO' on first use." },
        ],
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

/** The guide after its link text names the page. */
export const CORRECTED_LINK_TEXT_GUIDE = `# Guide

Read [request guide](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`;

/** A guide with the link text here. */
export const LINK_TEXT_GUIDE = `# Guide

Read [here](guide.md).

\`\`\`markdown
[here](guide.md)
\`\`\`
`;

/** A guide whose headings use a reviewed product name and title case. */
export const HEADING_CASE_GUIDE = `# Guide

## HTTP request rules

## Microsoft Edge settings

## HTTP Request Rules
`;

/** ESLint suppression comments with reasons, which Vale must not read as prose. */
export const SUPPRESSION_COMMENTS = [
    '// eslint-disable -- reason: The external declaration requires this signature.',
    '// eslint-enable no-x, @scope/no-y -- reason: Checks resume here.',
    '// eslint-disable-line no-x -- reason: The external declaration requires this signature.',
    '// eslint-disable-next-line no-x -- reason: Punctuation -- stays checked.',
    '// Punctuation -- stays checked.',
    '',
] as const;

/** The root and a child scope, each with the word it accepts. */
export const SCOPE_SPELLING_CASES = [{ scope: '' }, { scope: 'app' }] as const;

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

export const VERSION_RANGE_FINDINGS = [
    { file: 'versions.md', line: 4, rule: 'Example.Versions' },
    { file: 'versions.md', line: 5, rule: 'Example.Versions' },
    { file: 'versions.md', line: 6, rule: 'Example.Versions' },
] as const;
