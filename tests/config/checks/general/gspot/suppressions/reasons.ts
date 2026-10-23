export const TYPESCRIPT_SUPPRESSIONS = ['ignore', 'expect-error', 'nocheck'] as const;

export const COMPILER_REASON = 'A separate sandbox checks the external declaration.';

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

export const SWIFT_REASON_CASES = [
    { directive: 'swiftformat:disable blockComments', rule: 'swiftformat-no-reason' },
    { directive: 'periphery:ignore', rule: 'periphery-no-reason' },
] as const;
