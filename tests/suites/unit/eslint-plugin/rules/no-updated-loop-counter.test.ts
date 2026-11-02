import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-updated-loop-counter', plugin.rules['no-updated-loop-counter'], {
    valid: [
        'for (let index = 0; index < 10; index++) { index += 2; }',
        'for (let index = 0; index < 10; index++) { index++; }',
        'for (let index = 0; index < 10; index++) { items.splice(index, 1); index = index - 1; }',
        'for (let index = 0; index < 10; index++) index = 3;',
        'for (const item of items) { item = next(item); }',
    ],
    invalid: [
        {
            code: 'for (let index = 0; index < 10; index++) { index = 5; }',
            errors: [{ messageId: 'counter', data: { name: 'index' } }],
        },
        {
            code: 'for (let index = 0; index < 10; index++) { for (let inner = 0; inner < 3; index++) {} }',
            errors: [{ messageId: 'counter' }],
        },
    ],
});
