import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-lazy-before-optional', plugin.rules['no-lazy-before-optional'], {
    valid: ['/a*?b/u;', '/a*b*/u;', '/a+?/u;'],
    invalid: [
        { code: '/a*?b*/u;', errors: [{ messageId: 'lazy', data: { minimum: 0 } }] },
        { code: '/x|a{2,}?c*/u;', errors: [{ messageId: 'lazy', data: { minimum: 2 } }] },
    ],
});
