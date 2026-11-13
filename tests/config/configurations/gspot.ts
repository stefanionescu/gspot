export const JSX_COMMENTS = [
    'const element = <div title="// eslint-disable no-alert">',
    '// eslint-disable no-console',
    '{/* eslint-disable no-debugger */}',
    '</div>;',
    '// eslint-disable-next-line no-alert',
    'alert(element);',
].join('\n');
export const LIMIT_SUPPRESSION_CASES = [
    {
        configuration: 'javascript',
        name: 'complexity',
        file: 'source.js',
        directive: '// eslint-disable-next-line complexity -- reason: The external interface fixes this statement.',
        code: 'console.log(1);',
        rule: 'eslint-limit',
    },
    {
        configuration: 'javascript',
        name: 'all ESLint rules',
        file: 'source.js',
        directive: '// eslint-disable-next-line  -- reason: The external interface fixes this statement.',
        code: 'console.log(1);',
        rule: 'eslint-all',
    },
    {
        configuration: 'python',
        name: 'C901',
        file: 'source.py',
        directive: '# ruff: noqa: C901 # reason: The external interface fixes this statement.',
        code: 'print(1)',
        rule: 'ruff-limit',
    },
    {
        configuration: 'python',
        name: 'all Ruff rules',
        file: 'source.py',
        directive: '# ruff: noqa # reason: The external interface fixes this statement.',
        code: 'print(1)',
        rule: 'ruff-all',
    },
    {
        configuration: 'swift',
        name: 'cyclomatic_complexity',
        file: 'Source.swift',
        directive: '// swiftlint:disable cyclomatic_complexity // reason: The external interface fixes this statement.',
        code: 'let value = 1',
        rule: 'swiftlint-limit',
    },
    {
        configuration: 'swift',
        name: 'all',
        file: 'Source.swift',
        directive: '// swiftlint:disable all // reason: The external interface fixes this statement.',
        code: 'let value = 1',
        rule: 'swiftlint-all',
    },
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
export const SUPPRESSION_REASONS = [
    {
        configuration: 'sql',
        file: 'query.sql',
        bare: '-- noqa: LT01',
        explained: '-- noqa: LT01 -- The query keeps the vendor spacing.',
        rule: 'sqlfluff-no-reason',
    },
    {
        configuration: 'css',
        file: 'source.css',
        bare: '/* stylelint-disable */',
        explained: '/* stylelint-disable -- The vendor sheet keeps its names. */',
        rule: 'stylelint-no-reason',
    },
    {
        configuration: 'html',
        file: 'page.html',
        bare: '<!-- html-validate-disable -->',
        explained: '<!-- [html-validate-disable-next void-style: The embed owns its markup.] -->',
        rule: 'html-validate-no-reason',
    },
    {
        configuration: 'markdown',
        file: 'guide.md',
        bare: '<!-- markdownlint-disable -->',
        explained: '<!-- markdownlint-disable -- The table is generated. -->',
        rule: 'markdownlint-cli2-no-reason',
    },
    {
        configuration: 'swift',
        file: 'Value.swift',
        bare: '// swiftformat:disable blockComments',
        explained: '// swiftformat:disable blockComments - The external declaration retains its layout.',
        rule: 'swiftformat-no-reason',
    },
    {
        configuration: 'swift',
        file: 'Value.swift',
        bare: '// periphery:ignore',
        explained: '// periphery:ignore - The external declaration retains its layout.',
        rule: 'periphery-no-reason',
    },
    {
        configuration: 'typescript',
        file: 'source.ts',
        bare: '// @ts-ignore',
        explained: '// @ts-ignore: A separate sandbox checks the external declaration.',
        rule: 'tsc-no-reason',
    },
    {
        configuration: 'typescript',
        file: 'source.ts',
        bare: '// @ts-expect-error',
        explained: '// @ts-expect-error: A separate sandbox checks the external declaration.',
        rule: 'tsc-no-reason',
    },
    {
        configuration: 'typescript',
        file: 'source.ts',
        bare: '// @ts-nocheck',
        explained: '// @ts-nocheck: A separate sandbox checks the external declaration.',
        rule: 'tsc-no-reason',
    },
    {
        configuration: 'vitest',
        file: 'source.js',
        bare: '/* v8 ignore next */',
        explained: '/* v8 ignore next -- reason: only a full disk reaches this branch */',
        rule: 'vitest-no-reason',
    },
    {
        configuration: 'jest',
        file: 'source.js',
        bare: '/* istanbul ignore next */',
        explained: '/* istanbul ignore next: only a full disk reaches this branch */',
        rule: 'jest-no-reason',
    },
    {
        configuration: 'svelte',
        file: 'Form.svelte',
        bare: '<!-- svelte-ignore a11y_autofocus -->',
        explained: '<!-- svelte-ignore a11y_autofocus - reason: the dialog opens with the search field in focus -->',
        rule: 'svelte-check-no-reason',
    },
] as const;
export const SUPPRESSION_REASON_CASES = [
    {
        name: 'an ESLint reason directly above the suppression counts',
        path: 'source.ts',
        source: '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
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
            },
        ],
    },
] as const;
const ESLINT_SUPPRESSIONS = [
    ['// Example eslint-disable-next-line no-console', false],
    ['// eslint-disable no-console', false],
    ['/** Documentation\n * eslint-disable no-console\n */', false],
    ['// eslint-disable-next-line no-console', true],
    ['/*\n eslint-disable no-console\n */', true],
    ['/*eslint-disable no-console*/', true],
    ['// eslint-disable-next-line*/', false],
    ['/*eslint-disable-unknown*/', false],
] as const;
const HTML_VALIDATE_SUPPRESSIONS = [
    ['<!-- Example html-validate-disable wcag/h37 -->', false],
    ['<!-- html-validate-disable-unknown wcag/h37 -->', false],
    ['<!--html-validate-disable wcag/h37-->', true],
    ['<!--\nhtml-validate-disable wcag/h37\n-->', true],
    ['<!-- [html-validate-disable wcag/h37] -->', true],
] as const;
const STYLELINT_SUPPRESSIONS = [
    ['/*stylelint-disable*/', true],
    ['/* Example stylelint-disable color-no-invalid-hex */', false],
    ['/* stylelint-disable-unknown color-no-invalid-hex */', false],
    ['/*\n stylelint-disable color-no-invalid-hex\n*/', true],
    ['/**\n * stylelint-disable color-no-invalid-hex\n */', false],
    ['/* STYLELINT-DISABLE color-no-invalid-hex */', false],
] as const;
export const SUPPRESSION_SYNTAX_CASES = [
    {
        name: 'ESLint',
        configuration: 'javascript',
        extension: 'js',
        form: 'eslint',
        rows: ESLINT_SUPPRESSIONS,
        body: 'console.log(1);',
    },
    {
        name: 'Stylelint',
        configuration: 'css',
        extension: 'css',
        form: 'stylelint',
        rows: STYLELINT_SUPPRESSIONS,
        body: 'a { color: #ggg; }',
    },
    {
        name: 'HTML Validate',
        configuration: 'html',
        extension: 'html',
        form: 'html-validate',
        rows: HTML_VALIDATE_SUPPRESSIONS,
        body: '<img src="sample.png">',
    },
] as const;
