import { noEmptyRepetition } from '#eslint-plugin/rules/regex/no-empty-repetition.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-empty-repetition', noEmptyRepetition, {
    valid: ['/(?:ab)+/u;', '/a*b/u;', 'new RegExp(pattern);'],
    invalid: [
        { code: '/(a*)*/u;', errors: [{ messageId: 'empty', data: { part: '(a*)' } }] },
        { code: '/(?:a?)+b/u;', errors: [{ messageId: 'empty' }] },
        { code: '/(a|)*/u;', errors: [{ messageId: 'empty' }] },
        { code: String.raw`/(\b)*x/u;`, errors: [{ messageId: 'empty' }] },
        { code: 'new RegExp("(?:a*b*)+");', errors: [{ messageId: 'empty' }] },
    ],
});
