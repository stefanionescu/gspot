import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noDuplicateInComposite } from '#eslint-plugin/rules/types/no-duplicate-in-composite.ts';

buildRuleTester().run('no-duplicate-in-composite', noDuplicateInComposite, {
    valid: ['type Id = string | number;'],
    invalid: [
        {
            code: 'type Id = string | number | string;',
            errors: [{ messageId: 'duplicate', data: { text: 'string' }, column: 29 }],
        },
    ],
});
