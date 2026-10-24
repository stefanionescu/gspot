const ESLINT_SUPPRESSIONS = [
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

const STYLELINT_SUPPRESSIONS = [
    ['/* stylelint-disable color-no-invalid-hex */', true],
    ['/*stylelint-disable*/', true],
    ['/* stylelint-disable-next-line color-no-invalid-hex */', true],
    ['/* Example stylelint-disable color-no-invalid-hex */', false],
    ['/* stylelint-disable-unknown color-no-invalid-hex */', false],
    ['/*\n stylelint-disable color-no-invalid-hex\n*/', true],
    ['/**\n * stylelint-disable color-no-invalid-hex\n */', false],
    ['/* STYLELINT-DISABLE color-no-invalid-hex */', false],
] as const;

const HTML_VALIDATE_SUPPRESSIONS = [
    ['<!-- html-validate-disable wcag/h37 -->', true],
    ['<!-- html-validate-disable-next wcag/h37 -->', true],
    ['<!-- Example html-validate-disable wcag/h37 -->', false],
    ['<!-- html-validate-disable-unknown wcag/h37 -->', false],
    ['<!--html-validate-disable wcag/h37-->', true],
    ['<!--\nhtml-validate-disable wcag/h37\n-->', true],
    ['<!-- [html-validate-disable wcag/h37] -->', true],
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

export const LIMIT_SUPPRESSION_CASES = [
    {
        configuration: 'javascript',
        name: 'complexity',
        file: 'source.js',
        directive: '// eslint-disable-next-line complexity -- reason: The external interface fixes this statement.',
        code: 'console.log(1);',
        rule: 'eslint-limit',
        message: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
    },
    {
        configuration: 'javascript',
        name: 'all ESLint rules',
        file: 'source.js',
        directive: '// eslint-disable-next-line  -- reason: The external interface fixes this statement.',
        code: 'console.log(1);',
        rule: 'eslint-all',
        message: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    },
    {
        configuration: 'python',
        name: 'C901',
        file: 'source.py',
        directive: '# ruff: noqa: C901 # reason: The external interface fixes this statement.',
        code: 'print(1)',
        rule: 'ruff-limit',
        message: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
    },
    {
        configuration: 'python',
        name: 'all Ruff rules',
        file: 'source.py',
        directive: '# ruff: noqa # reason: The external interface fixes this statement.',
        code: 'print(1)',
        rule: 'ruff-all',
        message: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    },
    {
        configuration: 'swift',
        name: 'cyclomatic_complexity',
        file: 'Source.swift',
        directive: '// swiftlint:disable cyclomatic_complexity // reason: The external interface fixes this statement.',
        code: 'let value = 1',
        rule: 'swiftlint-limit',
        message: 'Split the code by its steps, or ask the user to raise the limit in gspot.toml.',
    },
    {
        configuration: 'swift',
        name: 'all',
        file: 'Source.swift',
        directive: '// swiftlint:disable all // reason: The external interface fixes this statement.',
        code: 'let value = 1',
        rule: 'swiftlint-all',
        message: 'This comment turns off every rule, including the size limits. Name the rules and give a reason.',
    },
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
