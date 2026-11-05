import { noInconsistentFunctionCall } from '#eslint-plugin/rules/functions/no-inconsistent-function-call.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-inconsistent-function-call', noInconsistentFunctionCall, {
    valid: ['function Point() {} new Point(); new Point();', 'new Date(); Date();'],
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
