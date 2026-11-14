import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noLazyBeforeOptional } from '#eslint-plugin/rules/regex/no-lazy-before-optional.ts';

buildRuleTester().run('no-lazy-before-optional', noLazyBeforeOptional, {
    valid: ['/a*?b/u;', '/a*b*/u;', '/a+?/u;', '/a*?b+/u;'],
    invalid: [{ code: '/x|a{2,}?c*/u;', errors: [{ messageId: 'lazy', data: { minimum: 2 } }] }],
});
