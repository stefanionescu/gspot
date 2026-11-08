import { noUpdatedLoopCounter } from '#eslint-plugin/rules/control-flow/no-updated-loop-counter.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-updated-loop-counter', noUpdatedLoopCounter, {
    valid: [
        'for (let index = 0; index < 10; index++) { index += 2; }',
        'for (let index = 0; index < 10; index++) { index++; }',
        'for (let index = 0; index < 10; index++) { items.splice(index, 1); index = index - 1; }',
        'for (let index = 0; index < 10; index++) { const [item] = items.splice(index, 1); index = index - 1; }',
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
        ...[
            'for (let index = 0; index < 10; index += 2) { index = 5; }',
            'for (let index = 0, size = 3; index < 10; index++, size++) { index = 5; }',
            'for (let index = 0; index < 10; index++) { [index] = next(); }',
        ].map((code) => ({ code, errors: [{ messageId: 'counter' as const, data: { name: 'index' } }] })),
    ],
});
