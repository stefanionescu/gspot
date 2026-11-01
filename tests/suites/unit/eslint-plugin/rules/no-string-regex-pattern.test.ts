import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester, buildTypedRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-string-regex-pattern without types', plugin.rules['no-string-regex-pattern'], {
    valid: ['"title".match("v1.2");'],
    invalid: [],
});

buildTypedRuleTester().run('no-string-regex-pattern', plugin.rules['no-string-regex-pattern'], {
    valid: [
        String.raw`declare const title: string; title.match(/v1\.2/u);`,
        'declare const title: string, pattern: RegExp; title.search(pattern);',
        'declare const title: string; title.replace("v1", "v2");',
        'declare const tracker: { match(value: string): void }; tracker.match("v1");',
    ],
    invalid: [
        {
            code: 'declare const title: string; title.match("v1.2");',
            errors: [{ messageId: 'pattern', data: { method: 'match' } }],
        },
        {
            code: 'declare const title: string, pattern: string; title.search(pattern);',
            errors: [{ messageId: 'pattern', data: { method: 'search' } }],
        },
        { code: 'declare const title: string; title.matchAll("[a]");', errors: [{ messageId: 'pattern' }] },
    ],
});
