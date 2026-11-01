import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-duplicate-in-composite', plugin.rules['no-duplicate-in-composite'], {
    valid: ['type Id = string | number;', 'type Shape = Circle & Named;'],
    invalid: [
        {
            code: 'type Id = string | number | string;',
            errors: [{ messageId: 'duplicate', data: { text: 'string' }, column: 29 }],
        },
        { code: 'type Id = Missing | Missing;', errors: [{ messageId: 'duplicate' }] },
        { code: 'type Shape = { size: 1 } & { size: 1 };', errors: [{ messageId: 'duplicate' }] },
    ],
});
