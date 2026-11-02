import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-unknown-regex-group', plugin.rules['no-unknown-regex-group'], {
    valid: [
        'const date = pattern.exec(text); date.groups.day;',

        String.raw`const date = /(?<year>\d+)/u.exec(text); date?.groups?.year;`,
        String.raw`const date = text.match(/(?<year>\d+)/u); const { year } = date.groups;`,
        'const date = read(text); date.groups.day;',
        String.raw`const date = /(?<year>\d+)/u.exec(text); log(date.groups);`,
        String.raw`const date = /(?<year>\d+)/u.exec(text); date.groups[key];`,
        String.raw`const date = /(?<year>\d+)/u.exec(text); const { year, ...rest } = date.groups;`,
    ],
    invalid: [
        {
            code: String.raw`const date = /(?<year>\d+)/u.exec(text); date?.groups?.day;`,
            errors: [{ messageId: 'unknown', data: { name: 'day' } }],
        },
        {
            code: String.raw`const pattern = /(?<year>\d+)/u; const date = pattern.exec(text); date!.groups!["day"];`,
            errors: [{ messageId: 'unknown', data: { name: 'day' } }],
        },
        {
            code: String.raw`const date = text.match(/(?<year>\d+)/u); const { year, day } = date.groups;`,
            errors: [{ messageId: 'unknown', data: { name: 'day' } }],
        },
        {
            code: String.raw`const date = text.match(/(?<year>\d+)/u); ({ day } = date.groups);`,
            errors: [{ messageId: 'unknown', data: { name: 'day' } }],
        },
        {
            code: String.raw`let date; date = text.matchAll(/(?<year>\d+)/gu); date.indices.groups.day;`,
            errors: [{ messageId: 'unknown', data: { name: 'day' } }],
        },
    ],
});
