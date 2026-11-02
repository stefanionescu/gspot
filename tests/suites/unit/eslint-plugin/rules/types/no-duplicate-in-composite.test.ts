import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-duplicate-in-composite', plugin.rules['no-duplicate-in-composite'], {
    valid: ['type Id = string | number;'],
    invalid: [
        {
            code: 'type Id = string | number | string;',
            errors: [{ messageId: 'duplicate', data: { text: 'string' }, column: 29 }],
        },
    ],
});
