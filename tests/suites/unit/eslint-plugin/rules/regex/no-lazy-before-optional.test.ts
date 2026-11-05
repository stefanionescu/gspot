import { noLazyBeforeOptional } from '#eslint-plugin/rules/regex/no-lazy-before-optional.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-lazy-before-optional', noLazyBeforeOptional, {
    valid: ['/a*?b/u;', '/a*b*/u;', '/a+?/u;'],
    invalid: [
        { code: '/a*?b*/u;', errors: [{ messageId: 'lazy', data: { minimum: 0 } }] },
        { code: '/x|a{2,}?c*/u;', errors: [{ messageId: 'lazy', data: { minimum: 2 } }] },
    ],
});
