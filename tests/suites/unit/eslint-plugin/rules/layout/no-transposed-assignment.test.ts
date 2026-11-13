import { noTransposedAssignment } from '#eslint-plugin/rules/layout/no-transposed-assignment.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-transposed-assignment', noTransposedAssignment, {
    valid: ['count = +increment;', 'count=+increment;', 'count = (+ value);', 'count = ~ value;', 'count += + value;'],
    invalid: [
        { code: 'count =+ increment;', errors: [{ messageId: 'operator' }] },
        { code: 'const count =+ value;', errors: [{ messageId: 'operator' }] },
    ],
});
