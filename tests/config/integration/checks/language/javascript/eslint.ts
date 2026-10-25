const JAVASCRIPT_MODULE = `// Doubles numbers.

/**
Doubles a number, and returns an infinite number unchanged.

@param {number} value the operand to multiply
@returns {number} twice the value
*/
export function twice(value) {
    if (Number.isNaN(value)) throw new RangeError('A missing number has no double.');
    return Number.isFinite(value) ? value * 2 : value;
}
`;

export const ESLINT_SANDBOX = {
    configurations: ['javascript'],
    files: {
        'package.json':
            '{"name":"example","version":"1.0.0","description":"A JavaScript repository.","private":true,"type":"module","packageManager":"bun@1.4.2"}\n',
        'src/main.js': JAVASCRIPT_MODULE,
    },
} as const;

export const DEBUGGER_SAMPLE = {
    check: 'javascript/eslint',
    files: {
        'src/paused.js': JAVASCRIPT_MODULE.replace('    return Number', '    debugger;\n    return Number'),
    },
    expected: { file: 'src/paused.js', line: 11, rule: 'no-debugger' },
    corrected: { files: { 'src/paused.js': JAVASCRIPT_MODULE } },
};
