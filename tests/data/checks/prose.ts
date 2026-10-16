import { TYPO } from '#tests/data/checks/spelling.ts';
import { GUIDE, README, LICENSE } from '#tests/data/checks/docs.ts';

export const VALE_ALERT = {
    Line: 1,
    Span: [3, 5],
    Check: 'gspot.Example',
    Message: 'Use a concrete example.',
} as const;

export const VALE_INI = `StylesPath = styles
MinAlertLevel = suggestion
[*]
BasedOnStyles = Example
`;

export const CONCRETE_RULE = `extends: existence
message: "Use inspect."
level: error
tokens: [delve]
`;

export const VALE_PACKAGE_FILES = {
    'Google/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'Microsoft/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'write-good/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'proselint/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'alex/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'RedHat/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'Harper/styles/Harper/terms.yml': `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`,
    'Harper/styles/config/dictionaries/harper.txt': `dictionary fixture
`,
} as const;

export const PACKAGE_STYLE_CASES = [
    {
        rule: 'gspot.ampm',
        sample: 'Meet at 1 pmsuffix.',
    },
    {
        rule: 'gspot.date-ordinals',
        sample: 'Released July first.',
    },
    {
        rule: 'gspot.jargon',
        sample: 'Select a glyph.',
    },
    {
        rule: 'gspot.militaristic-language',
        sample: 'Reduce the blast radius.',
    },
    {
        rule: 'gspot.ordinal-adverbs',
        sample: 'Firstly, run this command.',
    },
    {
        rule: 'gspot.percentage-numbers',
        sample: 'Use ten percent of it.',
    },
    {
        rule: 'gspot.time-ranges',
        sample: 'Run from 1 AM-2 PM.',
    },
    {
        rule: 'gspot.suspended-hyphens',
        sample: 'Use first- and second-order functions.',
    },
    {
        rule: 'gspot.url-prepositions',
        sample: 'Use the URL for this resource.',
    },
    {
        rule: 'gspot.numbered-units',
        sample: 'Use five meters.',
    },
    {
        rule: 'gspot.leading-conjunctions',
        sample: 'And run this command.',
    },
    {
        rule: 'gspot.conscious-language',
        sample: 'Use the blacklist.',
    },
    {
        rule: 'gspot.contractions',
        sample: "You can't run this command.",
    },
    {
        rule: 'gspot.punctuated-headings',
        sample: '## API.',
    },
    {
        rule: 'gspot.obvious-fields',
        sample: 'Use the Name field.',
    },
    {
        rule: 'gspot.product-centric-writing',
        sample: 'The tool allows you to work.',
    },
    {
        rule: 'gspot.session-identifiers',
        sample: 'Use resource?sessionId=12345678.',
    },
    {
        rule: 'gspot.straight-quotes',
        sample: 'Use \u2018native\u2019 text.',
    },
    {
        rule: 'gspot.merge-conflict-markers',
        sample: `<<<<<<< HEAD
One native branch.
=======
The other native branch.
>>>>>>> native`,
    },
] as const;

/** Currency notation in prose must not mistake source comment parameters for amounts. */
export const CURRENCY_CASES = [
    {
        path: 'prices.md',
        source: `# Prices

The price is $5.00.

The price is $15.

The price is 5 dollars.

The price is USD 5.
`,
        lines: [3, 5, 7],
    },
    { path: 'source.sh', source: '# Read $1 and $2 as positional parameters.\nprintf "%s" "$1"\n', lines: [] },
    { path: 'source.ts', source: '// Use $1 as the regular expression replacement.\nconst value = 1;\n', lines: [] },
] as const;

/** Each style keeps its substantive prose check without treating source notation as a finding. */
export const STYLE_CASES = [
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

export const VOCABULARY_SOURCE = `# Guide

Use sqlfluff and NebulaProduct.

Use ${TYPO.receive}.

Avoid vale's and ajv's.
`;

export const VALE_INSTALL_FAILURES = [
    ['timeout', 'setInterval(() => {}, 1000);', 'Vale sync ran longer than tool_timeout_seconds (1s).'],
    [
        'native error',
        'console.error("Registry request failed: https://alex:synthetic-password@example.com/styles.zip"); process.exitCode = 7;',
        'Registry request failed: https://[redacted]@example.com/styles.zip',
    ],
] as const;

export const FIXED_VALE_INSTALL_SCRIPT = String.raw`
if (process.env.NO_COLOR !== '1' || process.env.FORCE_COLOR !== '0') process.exit(9);
const { mkdirSync, writeFileSync } = await import('node:fs');
for (const name of ["Google", "write-good", "proselint", "alex", "Harper", "config/dictionaries"]) {
    mkdirSync('../vale/' + name, { recursive: true });
    writeFileSync('../vale/' + name + '/terms.yml', 'package bytes\\n');
}
writeFileSync('../vale/Google/terms.yml', 'corrected bytes\n');
`;

export const VALE_PACKAGES_INI = `StylesPath = ../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;

export const PROSE_CASES = [
    {
        check: 'prose/vale',
        files: {
            'docs/selling.md': `# A Page

This powerful cache easily makes the application much faster.
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

export const PROSE_SANDBOX = {
    configurations: ['prose'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;

export const GOOGLE_TERMS_FILE = '.gspot/vale/Google/terms.yml';
