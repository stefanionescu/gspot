import { requireReduceInitialValue } from '#eslint-plugin/rules/collections/require-reduce-initial-value.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('require-reduce-initial-value', requireReduceInitialValue, {
    valid: [
        'const prices = [1, 2]; prices.reduce((sum, price) => sum + price, 0);',
        'prices.reduce((sum, price) => sum + price);',
        '[1, 2].reduceRight((sum, price) => sum + price);',
    ],
    invalid: [
        { code: '[1, 2].reduce((sum, price) => sum + price);', errors: [{ messageId: 'initial' }] },
        {
            code: 'const prices = [1, 2]; prices.reduce((sum, price) => sum + price);',
            errors: [{ messageId: 'initial' }],
        },
    ],
});

buildTypedRuleTester().run('require-reduce-initial-value with types', requireReduceInitialValue, {
    valid: [],
    invalid: [
        {
            code: 'declare const prices: number[]; prices.reduce((sum, price) => sum + price);',
            errors: [{ messageId: 'initial' }],
        },
    ],
});
