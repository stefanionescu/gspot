export const SUPPRESSION_REASON_CASES = [
    {
        name: 'an ESLint reason directly above the suppression counts',
        path: 'source.ts',
        source: '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        findings: [],
    },
    {
        name: 'a ShellCheck reason directly above the suppression counts',
        path: 'source.sh',
        source: '# reason: The external command requires word splitting.\n# shellcheck disable=SC2086\necho $name\n',
        findings: [],
    },
    {
        name: 'a ShellCheck suppression without a reason is reported',
        path: 'source.sh',
        source: '# shellcheck disable=SC2086\necho $name\n',
        findings: [
            {
                line: 1,
                rule: 'shellcheck-no-reason',
                message: 'This shellcheck suppression has no reason of two or more words.',
            },
        ],
    },
    {
        name: 'a reason above a blank line does not count',
        path: 'source.ts',
        source: '// reason: The external interface requires this call.\n\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        findings: [
            {
                line: 3,
                rule: 'eslint-no-reason',
                message: 'This eslint suppression has no reason of two or more words.',
            },
        ],
    },
    {
        name: 'a reason in a string does not count',
        path: 'source.ts',
        source: 'const text = "// reason: The external interface requires this call.";\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        findings: [
            {
                line: 2,
                rule: 'eslint-no-reason',
                message: 'This eslint suppression has no reason of two or more words.',
            },
        ],
    },
    {
        name: 'a refused inline reason takes precedence over the preceding reason',
        path: 'source.ts',
        source: '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console -- N/A\nconsole.log(1);\n',
        findings: [
            {
                line: 2,
                rule: 'eslint-no-reason',
                message: 'This eslint suppression has no reason of two or more words.',
            },
        ],
    },
] as const;

export const SUPPRESSION_REASONS = [
    {
        configuration: 'sql',
        tool: 'sqlfluff',
        file: 'query.sql',
        bare: '-- noqa: LT01',
        explained: '-- noqa: LT01 -- The query keeps the vendor spacing.',
        rule: 'sqlfluff-no-reason',
    },
    {
        configuration: 'css',
        tool: 'stylelint',
        file: 'source.css',
        bare: '/* stylelint-disable */',
        explained: '/* stylelint-disable -- The vendor sheet keeps its names. */',
        rule: 'stylelint-no-reason',
    },
    {
        configuration: 'html',
        tool: 'html-validate',
        file: 'page.html',
        bare: '<!-- html-validate-disable -->',
        explained: '<!-- [html-validate-disable-next void-style: The embed owns its markup.] -->',
        rule: 'html-validate-no-reason',
    },
    {
        configuration: 'markdown',
        tool: 'markdownlint-cli2',
        file: 'guide.md',
        bare: '<!-- markdownlint-disable -->',
        explained: '<!-- markdownlint-disable -- The table is generated. -->',
        rule: 'markdownlint-cli2-no-reason',
    },
] as const;

export const SWIFT_REASON_CASES = [
    { directive: 'swiftformat:disable blockComments', rule: 'swiftformat-no-reason' },
    { directive: 'periphery:ignore', rule: 'periphery-no-reason' },
] as const;

export const TYPESCRIPT_SUPPRESSIONS = ['ignore', 'expect-error', 'nocheck'] as const;
