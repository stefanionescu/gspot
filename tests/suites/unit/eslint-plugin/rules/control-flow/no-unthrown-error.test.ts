import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unthrown-error', plugin.rules['no-unthrown-error'], {
    valid: ['throw new Error("Invalid value");', 'new Clock();', 'Error("Invalid value");'],
    invalid: [{ code: 'new Error("Invalid value");', errors: [{ messageId: 'error' }] }],
});
