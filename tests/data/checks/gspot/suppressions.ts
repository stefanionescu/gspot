// Compiler suppression comments keep their source location and authored reason.
export const TYPESCRIPT_SUPPRESSIONS = ['ignore', 'expect-error', 'nocheck'] as const;

export const COMPILER_REASON = 'A separate sandbox checks the external declaration.';

/** ESLint comments, and whether ESLint reads each one as a directive. */
export const ESLINT_SUPPRESSIONS = [
    ['// Example eslint-disable-next-line no-console', false],
    ['// eslint-disable no-console', false],
    ['/* Example eslint-disable no-console */', false],
    ['/** Documentation\n * eslint-disable no-console\n */', false],
    ['// eslint-disable-next-line no-console', true],
    ['/* eslint-disable no-console */', true],
    ['/*\n eslint-disable no-console\n */', true],
    ['/*eslint-disable no-console*/', true],
    ['/*eslint-disable-next-line no-console*/', true],
    ['// eslint-disable-next-line*/', false],
    ['/*eslint-disable-unknown*/', false],
] as const;

/** Stylelint comments, and whether Stylelint reads each one as a directive. */
export const STYLELINT_SUPPRESSIONS = [
    ['/* stylelint-disable color-no-invalid-hex */', true],
    ['/*stylelint-disable*/', true],
    ['/* stylelint-disable-next-line color-no-invalid-hex */', true],
    ['/* Example stylelint-disable color-no-invalid-hex */', false],
    ['/* stylelint-disable-unknown color-no-invalid-hex */', false],
    ['/*\n stylelint-disable color-no-invalid-hex\n*/', true],
    ['/**\n * stylelint-disable color-no-invalid-hex\n */', false],
    ['/* STYLELINT-DISABLE color-no-invalid-hex */', false],
] as const;

/** HTML Validate comments, and whether HTML Validate reads each one as a directive. */
export const HTML_VALIDATE_SUPPRESSIONS = [
    ['<!-- html-validate-disable wcag/h37 -->', true],
    ['<!-- html-validate-disable-next wcag/h37 -->', true],
    ['<!-- Example html-validate-disable wcag/h37 -->', false],
    ['<!-- html-validate-disable-unknown wcag/h37 -->', false],
    ['<!--html-validate-disable wcag/h37-->', true],
    ['<!--\nhtml-validate-disable wcag/h37\n-->', true],
    ['<!-- [html-validate-disable wcag/h37] -->', true],
] as const;

/** Reason comments above suppressions, and the lines the check reports for a missing reason. */
export const SUPPRESSION_REASON_CASES = [
    [
        'source.ts',
        `// reason: The external interface requires this call.
// eslint-disable-next-line no-console
console.log(1);
`,
        [],
    ],
    [
        'source.sh',
        `# reason: The external command requires word splitting.
# shellcheck disable=SC2086
echo $name
`,
        [],
    ],
    ['source.sh', '# shellcheck disable=SC2086\necho $name\n', [1]],
    [
        'source.ts',
        `// reason: The external interface requires this call.

// eslint-disable-next-line no-console
console.log(1);
`,
        [3],
    ],
    [
        'source.ts',
        `const text = "// reason: The external interface requires this call.";
// eslint-disable-next-line no-console
console.log(1);
`,
        [2],
    ],
    [
        'source.ts',
        `// reason: The external interface requires this call.
// eslint-disable-next-line no-console -- N/A
console.log(1);
`,
        [2],
    ],
] as const;

/** Suppression comments and the exact reasons their patterns must capture. */
export const SUPPRESSION_REASONS = [
    [
        'sql',
        'sqlfluff',
        '-- noqa: LT01',
        '-- noqa: LT01 -- The query keeps the vendor spacing.',
        'The query keeps the vendor spacing.',
    ],
    [
        'css',
        'stylelint',
        '/* stylelint-disable */',
        '/* stylelint-disable -- The vendor sheet keeps its names. */',
        'The vendor sheet keeps its names.',
    ],
    [
        'html',
        'html-validate',
        '<!-- html-validate-disable -->',
        '<!-- [html-validate-disable-next void-style: The embed owns its markup.] -->',
        'The embed owns its markup.',
    ],
    [
        'markdown',
        'markdownlint-cli2',
        '<!-- markdownlint-disable -->',
        '<!-- markdownlint-disable -- The table is generated. -->',
        'The table is generated.',
    ],
] as const;

export const QUOTED_ESLINT_COMMENTS = [
    String.raw`const apostrophe = "I am Sid\'s example"; // eslint-disable-line no-console`,
    'const template = `',
    '// eslint-disable-next-line no-alert',
    '// marker: Sample text is not a directive.',
    '`;',
    'const ordinary = "// marker: This is sample text.";',
    '// eslint-disable-next-line no-alert -- reason: External callback owns this call.',
    'alert(ordinary);',
    'function empty() { /* eslint-disable no-console */ }',
    'const nested = `${(() => { // eslint-disable-line no-alert',
    'return 1; })()}`;',
    '// marker: Required external interface.',
    'const active = 1;',
].join('\n');

export const JSX_COMMENTS = [
    'const element = <div title="// eslint-disable no-alert">',
    '// eslint-disable no-console',
    '{/* eslint-disable no-debugger */}',
    '</div>;',
    '// eslint-disable-next-line no-alert',
    'alert(element);',
].join('\n');

// Each Ruff directive, whether Ruff honors it for F401, and whether gspot records it as a directive on line 1.
export const RUFF_SUPPRESSIONS = [
    { source: 'import os # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # NOQA: F401\n', suppressed: true, directive: true },
    { source: 'import os # NoQa: F401\n', suppressed: true, directive: true },
    { source: 'import os # Example noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # Example # noqa: F401\n', suppressed: true, directive: true },
    { source: 'import os # noqa-unknown: F401\n', suppressed: false, directive: false },
    { source: 'import os # noqa: F401 # reason: External import.\n', suppressed: true, directive: true },
    { source: '# ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# ruff: NoQa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# flake8: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: '# Example # ruff: noqa: F401\nimport os\n', suppressed: true, directive: true },
    { source: 'import os # ruff: noqa: F401\n', suppressed: false, directive: false },
    { source: 'import os # flake8: noqa: F401\n', suppressed: false, directive: false },
    { source: '# RUFF: NOQA: F401\nimport os\n', suppressed: false, directive: false },
    { source: '# noqa: F401\nimport os\n', suppressed: false, directive: true },
    { source: 'import os # noqa: F821\n', suppressed: false, directive: true },
] as const;

/** The check refuses Vale directives and keeps code examples and ordinary comments. */
export const VALE_SUPPRESSIONS = [
    { source: '<!-- vale off -->', suppressed: true, directive: true },
    { source: '<!-- vale Example.Concrete = NO -->', suppressed: true, directive: true },
    { source: '<!-- vale Example.Concrete = YES -->', suppressed: false, directive: true },
    { source: '<!-- vale on -->', suppressed: false, directive: true },
    { source: '<!-- Example vale off -->', suppressed: false, directive: false },
    { source: '`<!-- vale off -->`', suppressed: false, directive: false },
    { source: '```markdown\n<!-- vale off -->\n```', suppressed: false, directive: false },
] as const;

export const EXPIRED_IGNORE_SETTINGS = `configurations = ["bash"]
# [[ignore]] here is a comment, not a record.

[[ "ignore" ]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "The sample preserves word splitting."
until = 2030-01-02

[[ignore]]
check = "bash/shellcheck"
rule = "SC2046"
reason = "The sample preserves command substitution."
until = 2099-01-01

[rules]
enabled = false
`;
