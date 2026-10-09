/** Native ESLint comment recognition cases shared by planting and assertions. */
export const SUPPRESSION_COMMENTS = [
    ['// Example eslint-disable-next-line no-console', false],
    ['// eslint-disable no-console', false],
    ['/* Example eslint-disable no-console */', false],
    ['/** Documentation\n * eslint-disable no-console\n */', false],
    ['// eslint-disable-next-line no-console', true],
    ['/* eslint-disable no-console */', true],
    ['/*\n eslint-disable no-console\n */', true],
    ['/*eslint-disable*/', true],
    ['/*eslint-disable-next-line*/', true],
    ['// eslint-disable-next-line*/', false],
    ['/*eslint-disable-unknown*/', false],
] as const;

/** Native Stylelint directive recognition cases. */
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

/** Native HTML Validate directive recognition cases. */
export const HTML_VALIDATE_SUPPRESSIONS = [
    ['<!-- html-validate-disable wcag/h37 -->', true],
    ['<!-- html-validate-disable-next wcag/h37 -->', true],
    ['<!-- Example html-validate-disable wcag/h37 -->', false],
    ['<!-- html-validate-disable-unknown wcag/h37 -->', false],
    ['<!--html-validate-disable wcag/h37-->', true],
    ['<!--\nhtml-validate-disable wcag/h37\n-->', true],
    ['<!-- [html-validate-disable wcag/h37] -->', true],
] as const;

/** Exact native directive reason cases shared by planting and observations. */
export const SUPPRESSION_REASON_CASES = [
    [
        'source.ts',
        '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        [],
    ],
    [
        'source.sh',
        '# reason: The external command requires word splitting.\n# shellcheck disable=SC2086\necho $name\n',
        [],
    ],
    ['source.sh', '# shellcheck disable=SC2086\necho $name\n', [1]],
    [
        'source.ts',
        '// reason: The external interface requires this call.\n\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        [3],
    ],
    [
        'source.ts',
        'const text = "// reason: The external interface requires this call.";\n// eslint-disable-next-line no-console\nconsole.log(1);\n',
        [2],
    ],
    [
        'source.ts',
        '// reason: The external interface requires this call.\n// eslint-disable-next-line no-console -- N/A\nconsole.log(1);\n',
        [2],
    ],
] as const;
