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
        name: 'empty report',
        output: '',
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        name: 'non-JSON text',
        output: 'not JSON',
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        name: 'non-array report',
        output: '{}',
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        name: 'empty rules',
        output: [{ ...MARKDOWN_REPORT, ruleNames: [] }],
        message: 'Markdownlint printed output that gspot cannot read.',
    },
    {
        name: 'invalid fix',
        output: [{ ...MARKDOWN_REPORT, fixInfo: [] }],
        message: 'Markdownlint printed output that gspot cannot read.',
    },
] as const;
