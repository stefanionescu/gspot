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
} as const;

export const MARKDOWNLINT_REPORT_ERRORS = [
    {
        name: 'non-array report',
        output: '{}',
    },
    {
        name: 'empty rules',
        output: [{ ...MARKDOWN_REPORT, ruleNames: [] }],
    },
    {
        name: 'invalid fix',
        output: [{ ...MARKDOWN_REPORT, fixInfo: [] }],
    },
] as const;
