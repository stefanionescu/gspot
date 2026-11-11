import { noStringRegexPattern } from '#eslint-plugin/rules/regex/no-string-regex-pattern.ts';
import { buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildTypedRuleTester().run('no-string-regex-pattern', noStringRegexPattern, {
    valid: [
        String.raw`declare const title: string; title.match(/v1\.2/u);`,
        'declare const title: string; title.replace("v1", "v2");',
        'declare const tracker: { match(value: string): void }; tracker.match("v1");',
    ],
    invalid: [
        {
            code: 'declare const title: string; title.match("v1.2");',
            errors: [{ messageId: 'pattern', data: { method: 'match' } }],
        },
    ],
});
