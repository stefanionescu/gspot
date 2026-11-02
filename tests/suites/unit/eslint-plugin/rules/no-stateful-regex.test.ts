import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-stateful-regex', plugin.rules['no-stateful-regex'], {
    valid: [
        'const word = /a/gu; word.test(first); word.lastIndex = 0; word.test(second);',
        'const word = /a/gu; word.test(first); word.test("");',
        'const word = /a/u; word.test(first); word.test(second);',
        'const word = /a/gu; while (word.exec(text)) {}',
        "const out = text.replaceAll(/a/gy, 'b');",
    ],
    invalid: [
        { code: 'while (/a/gu.exec(text)) {}', errors: [{ messageId: 'loop' }] },
        { code: 'do {} while (new RegExp("a", "g").exec(text));', errors: [{ messageId: 'loop' }] },
        {
            code: 'const word = /a/gu; word.test(first); word.test(second);',
            errors: [{ messageId: 'subjects', column: 14 }],
        },
    ],
});
