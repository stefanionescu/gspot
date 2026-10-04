/** Native suppression comments and the exact authored reasons their patterns must capture. */
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
