import { maxRegexComplexity } from '#eslint-plugin/rules/regex/max-regex-complexity.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('max-regex-complexity', maxRegexComplexity, {
    valid: [{ code: '/a+/u;', options: [{ threshold: 1 }] }],
    invalid: [
        {
            code: String.raw`/^(?:(?:[a-z0-9]+(?:[-_][a-z0-9]+)*)\.)+(?:com|org|net|io|dev)(?:\/(?:[a-z]+|\d+))*(?:\?[a-z]+=[a-z0-9]+(?:&[a-z]+=[a-z0-9]+)*)?$/u;`,
            errors: [{ messageId: 'complex', data: { score: 42, threshold: 20 } }],
        },
        {
            code: '/(?:a|b)+/u;',
            options: [{ threshold: 2 }],
            errors: [{ messageId: 'complex', data: { score: 3, threshold: 2 } }],
        },
        {
            code: String.raw`/(?=a|b)[x]\1(c)/u;`,
            options: [{ threshold: 0 }],
            errors: [{ messageId: 'complex', data: { score: 5, threshold: 0 } }],
        },
    ],
});
