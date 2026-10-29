export const SYNTAX_ERRORS = [
    {
        path: 'package.json',
        source: '{',
        message: 'package.json:1:2 is not valid JSON: CloseBraceExpected. Fix the file.',
    },
    {
        path: 'bun.lock',
        source: '{"value": }',
        message: 'bun.lock:1:11 is not valid JSON: ValueExpected. Fix the file.',
    },
];
