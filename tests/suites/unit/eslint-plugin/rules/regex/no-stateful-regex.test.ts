import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { noStatefulRegex } from '#eslint-plugin/rules/regex/no-stateful-regex.ts';

buildRuleTester().run('no-stateful-regex', noStatefulRegex, {
    valid: [
        'const word = /a/gu; word.test(first); word.lastIndex = 0; word.test(second);',
        'const word = /a/gu; word.test(first); word.test("");',
        'const word = /a/u; word.test(first); word.test(second);',
        'const word = /a/gu; while (word.exec(text)) {}',
        'const word = /a/gu; word.test(first); word.test();',
    ],
    invalid: [
        { code: 'do {} while (new RegExp("a", "g").exec(text));', errors: [{ messageId: 'loop' }] },
        {
            code: 'const word = /a/gu; word.test(first); word.test(second);',
            errors: [{ messageId: 'subjects', column: 14 }],
        },
        {
            code: 'const word = /a/gu; word.test(first); word.note = "first"; word.test(second);',
            errors: [{ messageId: 'subjects' }],
        },
    ],
});
