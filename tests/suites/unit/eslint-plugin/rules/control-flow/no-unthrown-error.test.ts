import { noUnthrownError } from '#eslint-plugin/rules/control-flow/no-unthrown-error.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unthrown-error', noUnthrownError, {
    valid: ['throw new Error("Invalid value");', 'new Clock();'],
    invalid: [{ code: 'new Error("Invalid value");', errors: [{ messageId: 'error' }] }],
});
