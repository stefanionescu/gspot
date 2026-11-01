import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('reduce-initial-value', plugin.rules['reduce-initial-value'], {
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

buildTypedRuleTester().run('reduce-initial-value with types', plugin.rules['reduce-initial-value'], {
    valid: ['declare const prices: Set<number>; prices.forEach((price) => price);'],
    invalid: [
        {
            code: 'declare const prices: number[]; prices.reduce((sum, price) => sum + price);',
            errors: [{ messageId: 'initial' }],
        },
    ],
});
