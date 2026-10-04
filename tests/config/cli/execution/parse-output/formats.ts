import { TYPO } from '#tests/config/harness/spelling.ts';

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
    { configuration: 'markdown', stdout: '{}', message: 'Markdownlint returned invalid structured findings.' },
    {
        configuration: 'markdown',
        stdout: '[{"fileName":"missing.md","lineNumber":1,"ruleNames":["MD033"],"ruleDescription":"Inline HTML","errorDetail":"Element: span","errorContext":null,"errorRange":[1,6],"fixInfo":null,"severity":"error"}]',
        message: 'Cannot read reported source file missing.md.',
    },
    {
        configuration: 'markdown',
        stdout: '[{"fileName":"sample.md","lineNumber":999,"ruleNames":["MD033"],"ruleDescription":"Inline HTML","errorDetail":"Element: span","errorContext":null,"errorRange":[1,6],"fixInfo":null,"severity":"error"}]',
        message: 'Markdownlint reported a position outside the source: sample.md',
    },
    { configuration: 'spelling', stdout: '{', message: 'Typos returned invalid structured findings.' },
    {
        configuration: 'spelling',
        stdout: '{"type":"typo","path":"missing.txt","line_num":1,"byte_offset":0,"typo":"teh","corrections":["the"]}',
        message: 'Cannot read reported source file missing.txt.',
    },
    {
        configuration: 'spelling',
        stdout: '{"type":"typo","path":"sample.txt","line_num":1,"byte_offset":999,"typo":"teh","corrections":["the"]}',
        message: 'Typos reported a position outside the source: sample.txt',
    },
] as const;
