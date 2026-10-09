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
