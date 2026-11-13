import { test } from 'bun:test';

import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

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

const ESLINT_SANDBOX = {
    configurations: ['javascript'],
    files: {
        'package.json':
            '{"name":"example","version":"1.0.0","description":"A JavaScript repository.","private":true,"type":"module","packageManager":"bun@1.4.2"}\n',
        'src/main.js': JAVASCRIPT_MODULE,
    },
} as const;

const DEBUGGER_SAMPLE = {
    check: 'javascript/eslint',
    files: {
        'src/paused.js': JAVASCRIPT_MODULE.replace('    return Number', '    debugger;\n    return Number'),
    },
    expected: { file: 'src/paused.js', line: 11, rule: 'no-debugger' },
    corrected: { files: { 'src/paused.js': JAVASCRIPT_MODULE } },
};

const eslintSandbox = shareInstalledSandbox({ ...ESLINT_SANDBOX, level: 'basic' });

test('javascript/eslint runs with only the packages that the javascript configuration installs', async () => {
    await assertCheckSample(eslintSandbox(), DEBUGGER_SAMPLE);
});

test('javascript/import-cycles reports a cycle and skips a disable comment for a plugin it does not load', async () => {
    await assertCheckSample(eslintSandbox(), {
        check: 'javascript/import-cycles',
        files: {
            'src/first.js':
                "import { second } from './second.js';\n\n// eslint-disable-next-line acme/no-loops -- reason: the project loads acme.\nexport const first = second;\n",
            'src/second.js': "import { first } from './first.js';\n\nexport const second = first;\n",
        },
        expected: { file: 'src/first.js', line: 1, rule: 'import-x/no-cycle' },
        findings: [
            { file: 'src/first.js', line: 1, rule: 'import-x/no-cycle' },
            { file: 'src/second.js', line: 1, rule: 'import-x/no-cycle' },
        ],
        corrected: { files: { 'src/second.js': 'export const second = 2;\n' } },
    });
});
