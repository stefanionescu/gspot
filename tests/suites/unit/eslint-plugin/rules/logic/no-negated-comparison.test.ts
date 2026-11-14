import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noNegatedComparison } from '#eslint-plugin/rules/logic/no-negated-comparison.ts';

buildRuleTester().run('no-negated-comparison', noNegatedComparison, {
    valid: ['!(first + second);', 'typeof (first === second);'],
    invalid: [{ code: '!(first === second);', errors: [{ messageId: 'comparison' }] }],
});
