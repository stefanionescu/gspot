import { TYPO } from '#tests/config/samples/spelling.ts';

export const EDITORCONFIG_REPORT =
    'source.js:\n\tWrong line endings or no final newline\n notes.txt:\n\t1: Trailing whitespace\n\n2 errors found\n';

export const MARKDOWN_REPORT = {
    fileName: 'sample.md',
    lineNumber: 1,
    ruleNames: ['MD033'],
    ruleDescription: 'Inline HTML',
    errorDetail: 'Element: span',
    errorContext: null,
    errorRange: [1, 6],
    fixInfo: null,
    severity: 'error',
};

export const TYPO_REPORT = {
    type: 'typo',
    path: 'sample.txt',
    line_num: 1,
    byte_offset: 0,
    typo: TYPO.the,
    corrections: ['the'],
};

export const REPORT_ERRORS = [
    {
        configuration: 'markdown',
        name: 'empty report',
        output: '',
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'non-JSON text',
        output: 'not JSON',
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'non-array report',
        output: '{}',
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'empty rules',
        output: [{ ...MARKDOWN_REPORT, ruleNames: [] }],
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'outside column',
        output: [{ ...MARKDOWN_REPORT, errorRange: [999, 1] }],
        message: 'Markdownlint reported a position outside the source: sample.md',
    },
    {
        configuration: 'markdown',
        name: 'outside line',
        output: [{ ...MARKDOWN_REPORT, lineNumber: 999 }],
        message: 'Markdownlint reported a position outside the source: sample.md',
    },
    {
        configuration: 'markdown',
        name: 'escaping path',
        output: [{ ...MARKDOWN_REPORT, fileName: '../outside.md' }],
        message: 'Cannot read reported source file ../outside.md.',
    },
    {
        configuration: 'markdown',
        name: 'invalid fix',
        output: [{ ...MARKDOWN_REPORT, fixInfo: [] }],
        message: 'Markdownlint returned invalid structured findings.',
    },
    {
        configuration: 'markdown',
        name: 'missing source',
        output: [{ ...MARKDOWN_REPORT, fileName: 'missing.md' }],
        message: 'Cannot read reported source file missing.md.',
    },
    {
        configuration: 'spelling',
        name: 'unfinished JSON',
        output: '{',
        message: 'Typos returned invalid structured findings.',
    },
    {
        configuration: 'spelling',
        name: 'partial typo',
        output: { type: 'typo', path: 'sample.txt', typo: TYPO.the },
        message: 'Typos returned invalid structured findings.',
    },
    {
        configuration: 'spelling',
        name: 'native error',
        output: { type: 'error', message: 'Read failed.' },
        message: 'Typos returned invalid structured findings.',
    },
    {
        configuration: 'spelling',
        name: 'escaping path',
        output: { ...TYPO_REPORT, path: '../outside.txt' },
        message: 'Cannot read reported source file ../outside.txt.',
    },
    {
        configuration: 'spelling',
        name: 'outside offset',
        output: { ...TYPO_REPORT, byte_offset: 99 },
        message: 'Typos reported a position outside the source: sample.txt',
    },
    {
        configuration: 'spelling',
        name: 'missing source',
        output: { ...TYPO_REPORT, path: 'missing.txt' },
        message: 'Cannot read reported source file missing.txt.',
    },
    {
        configuration: 'spelling',
        name: 'large offset',
        output: { ...TYPO_REPORT, byte_offset: 999 },
        message: 'Typos reported a position outside the source: sample.txt',
    },
] as const;
