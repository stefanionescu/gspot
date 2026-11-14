import { noEqualLoopCondition } from '#eslint-plugin/rules/control-flow/no-equal-loop-condition.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-equal-loop-condition', noEqualLoopCondition, {
    valid: [
        'for (let index = 0; index != 10; index++) {}',
        'for (let index = 10; index !== 0; index -= 1) {}',
        'for (let index = 0; index < limit; index += 2) {}',
        'for (let index = 0; limit !== 10; index++) {}',
        'for (let index = 0; index !== limit;) {}',
        'for (let index = 10; index != 0; index--) {}',
        'for (let index = 0; index != 10; index += 1) {}',
        'for (index = 0; index != 10; index++) {}',
        { code: 'for (let index = 1; index !== limit; index *= 2) {}', name: 'a product is not a step' },
    ],
    invalid: [
        {
            code: 'for (let index = 0; index !== limit; index += 2) {}',
            errors: [{ messageId: 'equality', data: { operator: '!==' } }],
        },
        {
            code: 'for (let index = 0; index != 10; index++) { read(index); }',
            errors: [{ messageId: 'equality', data: { operator: '!=' } }],
        },
        {
            code: 'for (let index = 10; index != 0; index++) {}',
            errors: [{ messageId: 'equality', data: { operator: '!=' } }],
        },
        {
            code: 'for (let index = 0; index == 10; index++) {}',
            errors: [{ messageId: 'equality', data: { operator: '==' } }],
        },
        {
            code: 'for (let row = 0, column = 0; row !== 10; row++, column++) {}',
            errors: [{ messageId: 'equality', data: { operator: '!==' } }],
        },
        { code: 'for (; index != 10; index++) {}', errors: [{ messageId: 'equality', data: { operator: '!=' } }] },
        {
            code: 'for (let index = start; index != 10; index++) {}',
            errors: [{ messageId: 'equality', data: { operator: '!=' } }],
        },
    ],
});
