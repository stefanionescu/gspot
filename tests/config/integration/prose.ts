import { dirname } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GUIDE } from '#tests/config/integration/language.ts';
import { TYPO, README, LICENSE } from '#tests/config/setup/configurations.ts';

export const PROSE_COMMENT_CASES = [
    ['mts', '//', 'const text = "delve";'],
    ['', '#', 'text = "delve"'],
] as const;

export const MARKDOWN_COMMENT_CASES = [
    ['ts', '//', 'const text = "whitelist";'],
    ['py', '#', 'text = "whitelist"'],
] as const;

export const CONCRETE_RULE = `extends: existence
message: "Use inspect."
level: error
tokens: [delve]
`;

export const PROSE_CASES = [
    {
        check: 'prose/vale',
        files: {
            'docs/selling.md': `# A Page

This powerful cache makes the application much faster.
`,
        },
        expected: { file: 'docs/selling.md', rule: 'gspot.marketing', line: 3, column: 6 },
        corrected: {
            files: {
                'docs/selling.md': `# A Page

This cache returns stored records.
`,
            },
        },
    },
] as const;

export const PACKAGE_STYLE_CASES = [
    { sample: 'Released July first.', findings: [[1, 'gspot.date-ordinals']] },
    { sample: 'Select a glyph.', findings: [[3, 'gspot.jargon']] },
    { sample: 'Firstly, run this command.', findings: [[5, 'gspot.ordinal-adverbs']] },
    { sample: 'Use ten percent of it.', findings: [[7, 'gspot.percentage-numbers']] },
    { sample: 'Run from 1 AM-2 PM.', findings: [[9, 'gspot.time-ranges']] },
    { sample: 'Use first- and second-order functions.', findings: [[11, 'gspot.suspended-hyphens']] },
    { sample: 'Use the URL for this resource.', findings: [[13, 'gspot.url-prepositions']] },
    { sample: 'Use five meters.', findings: [[15, 'gspot.numbered-units']] },
    { sample: 'And run this command.', findings: [[17, 'gspot.leading-conjunctions']] },
    { sample: 'Use the blacklist.', findings: [[19, 'gspot.conscious-language']] },
    { sample: "You can't run this command.", findings: [[21, 'gspot.contractions']] },
    { sample: '## API.', findings: [] },
    { sample: 'Use the Name field.', findings: [[25, 'gspot.obvious-fields']] },
    { sample: 'The tool allows you to work.', findings: [[27, 'gspot.product-centric-writing']] },
    { sample: 'Use resource?sessionId=12345678.', findings: [[29, 'gspot.session-identifiers']] },
    {
        sample: 'Use \u{2018}native\u{2019} text.',
        findings: [
            [31, 'gspot.straight-quotes'],
            [31, 'gspot.straight-quotes'],
        ],
    },
    {
        sample: `${'<'.repeat(7)} HEAD
One native branch.
${'='.repeat(7)}
The other native branch.
${'>'.repeat(7)} native`,
        findings: [
            [33, 'gspot.title-case'],
            [33, 'gspot.merge-conflict-markers'],
            [33, 'gspot.acronyms'],
            [34, 'Google.HeadingPunctuation'],
            [35, 'gspot.merge-conflict-markers'],
            [37, 'gspot.merge-conflict-markers'],
        ],
    },
] as const;

export const STYLE_CASES = [
    {
        rule: 'em-dashes',
        path: 'directives.md',
        source: '# Guide\n\nA sentence -- with punctuation.\n\nUse `// eslint-disable-next-line no-console -- reason: the command prints its result`.\n\nUse `value -- item`.\n\n```javascript\n// eslint-disable-next-line no-console -- reason: the command prints its result\n```\n',
        findings: [
            {
                line: 3,
                rule: 'gspot.em-dashes',
            },
        ],
    },
    {
        path: 'prices.md',
        source: '# Prices\n\nThe price is $5.00.\n\nThe price is $15.\n\nThe price is 5 dollars.\n\nThe price is USD 5.\n',
        rule: 'currency',
        findings: [
            { line: 3, rule: 'gspot.currency' },
            { line: 5, rule: 'gspot.currency' },
            { line: 7, rule: 'gspot.currency' },
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
        findings: [{ line: 3, rule: 'gspot.acronyms' }],
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
            },
        ],
    },
    {
        rule: 'file-paths',
        path: 'paths.md',
        source: `# Guide

Inspect src/view.tsx.

Use \`src/view.tsx\` in the command.
`,
        findings: [
            {
                line: 3,
                rule: 'gspot.file-paths',
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
        findings: [{ line: 3, rule: 'gspot.future' }],
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
            },
            {
                line: 5,
                rule: 'gspot.placeholders',
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
    { tag: '<img src="a.png" alt="x" />', missing: false },
] as const;

export const EXAMPLE_STYLE_FOLDER = `${dirname(GSPOT_PATHS.valeConfig)}/styles/Example`;

export const VALE_INI = `StylesPath = styles
MinAlertLevel = suggestion
[*]
BasedOnStyles = Example
`;

export const PROSE_SANDBOX = {
    configurations: ['prose'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;

export const COMMENT_SOURCE = "// The file is generated by ESLint's parser.\nexport const value = 1;\n";
