import { noNegatedComparison } from '#eslint-plugin/rules/logic/no-negated-comparison.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-negated-comparison', noNegatedComparison, {
    valid: ['!(first + second);', 'first !== second;'],
    invalid: [{ code: '!(first === second);', errors: [{ messageId: 'comparison' }] }],
});
