import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-negated-comparison', plugin.rules['no-negated-comparison'], {
    valid: ['!ready;', '!(first + second);', 'first !== second;'],
    invalid: [{ code: '!(first === second);', errors: [{ messageId: 'comparison' }] }],
});
