import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-inconsistent-function-call', plugin.rules['no-inconsistent-function-call'], {
    valid: [
        'function Point() {} new Point(); new Point();',
        'new Date(); Date();',
        'function read() {} read(); read();',
    ],
    invalid: [
        {
            code: 'function Point() {}\nnew Point();\nPoint();',
            errors: [{ messageId: 'inconsistent', data: { line: 2, other: 'with' }, line: 3 }],
        },
        {
            code: 'function Point() {} Point(); new Point(); new Point(); Point();',
            errors: [{ messageId: 'inconsistent', data: { line: 1, other: 'without' } }],
        },
    ],
});
