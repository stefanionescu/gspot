import { noAmbiguousAnchors } from '#eslint-plugin/rules/regex/no-ambiguous-anchors.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-ambiguous-anchors', noAmbiguousAnchors, {
    valid: [String.raw`/^\s+|\s+$/gu;`, '/^(?:a|b)$/u;', '/a|^b|c$/u;'],
    invalid: [
        { code: '/^a|b|c$/u;', errors: [{ messageId: 'anchors' }] },
        { code: '/^a|b/u;', errors: [{ messageId: 'anchors' }] },
        { code: 'new RegExp("a|b$");', errors: [{ messageId: 'anchors' }] },
    ],
});
