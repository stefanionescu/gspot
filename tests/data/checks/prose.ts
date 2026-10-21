import { TYPO } from '#tests/data/checks/spelling.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { GUIDE, README, LICENSE } from '#tests/data/checks/docs.ts';

const AMBIGUOUS_WORD_RULE = `extends: existence
message: "Avoid '%s'."
level: error
tokens:
  - ambiguousword
`;

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
    ...Object.fromEntries<string>(
        [
            'Google/terms.yml',
            'Microsoft/terms.yml',
            'write-good/terms.yml',
            'proselint/terms.yml',
            'alex/terms.yml',
            'RedHat/terms.yml',
            'Harper/styles/Harper/terms.yml',
        ].map((path) => [path, AMBIGUOUS_WORD_RULE]),
    ),
    'Harper/styles/config/dictionaries/harper.txt': `dictionary fixture
`,
};

export const PACKAGE_STYLE_CASES = [
    {
        rule: 'gspot.ampm',
        sample: 'Meet at 1 pm.',
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

export const VOCABULARY_SOURCE = `# Guide

Use sqlfluff and NebulaProduct.

Use ${TYPO.receive}.

Avoid vale's and ajv's.
`;

// Only the row that tests the time limit gets a short one; a slow start under load must not fail the other row.
export const VALE_INSTALL_FAILURES = [
    {
        name: 'timeout',
        script: 'setInterval(() => {}, 1000);',
        message: 'ran longer than tool_timeout_seconds (1s).',
        settings: 'tool_timeout_seconds = 1\n',
    },
    {
        name: 'its error',
        script: 'console.error("Registry request failed: https://alex:synthetic-password@example.com/styles.zip"); process.exitCode = 7;',
        message: 'Registry request failed: https://[redacted]@example.com/styles.zip',
        settings: '',
    },
] as const;

export const FIXED_VALE_INSTALL_SCRIPT = String.raw`
if (process.env.NO_COLOR !== '1' || process.env.FORCE_COLOR !== '0') process.exit(9);
const { mkdirSync, writeFileSync } = await import('node:fs');
for (const name of ["Google", "write-good", "proselint", "alex", "Harper", "config/dictionaries"]) {
    mkdirSync('../../../vale/' + name, { recursive: true });
    writeFileSync('../../../vale/' + name + '/terms.yml', 'package bytes\\n');
}
writeFileSync('../../../vale/Google/terms.yml', 'corrected bytes\n');
`;

export const VALE_PACKAGES_INI = `StylesPath = ../../../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;

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

/** A Markdown sandbox for the tests of valid and refused Vale output. */
export const VALE_SANDBOX_FILES = {
    'gspot.toml': buildSandboxSettings(['prose', 'markdown']),
    '.gspot/configurations/general/prose/vale.ini': 'Packages =\n',
    'example.md': '# Documentation\n',
};
