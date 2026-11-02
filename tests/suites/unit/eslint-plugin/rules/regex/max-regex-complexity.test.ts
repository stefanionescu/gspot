import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('max-regex-complexity', plugin.rules['max-regex-complexity'], {
    valid: ['/^(a|b|c)[a-z]+$/u;', { code: '/a+/u;', options: [{ threshold: 1 }] }],
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
        { code: '/(?=a+)b/u;', options: [{ threshold: 1 }], errors: [{ messageId: 'complex' }] },
    ],
});
