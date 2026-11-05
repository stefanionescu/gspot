import { expect, test } from 'bun:test';

import { escapeRegExp, formatNameList, formatScope, splitWords } from '#cli/system/text.ts';

test('an escaped text matches itself in a Unicode pattern, and each syntax character stays literal', () => {
    const text = String.raw`a.b*c+d?e^f$g{h}i(j)k|l[m]n\o/p-q`;
    expect(new RegExp(`^${escapeRegExp(text)}$`, 'u').test(text)).toBe(true);
    expect(new RegExp(`^${escapeRegExp('a.b')}$`, 'u').test('axb')).toBe(false);
});

test.each([
    { names: ['a', 'b', 'c'], type: undefined, joined: 'a, b, and c' },
    { names: ['a', 'b', 'c'], type: 'disjunction' as const, joined: 'a, b, or c' },
])('formatNameList joins $names as "$joined"', ({ names, type, joined }) => {
    expect(formatNameList(names, type)).toBe(joined);
});

test.each([
    { path: '', shown: '.' },
    { path: 'services/api', shown: 'services/api' },
])('formatScope prints "$path" as "$shown"', ({ path, shown }) => {
    expect(formatScope(path)).toBe(shown);
});

test.each([
    ['HTMLParser', ['html', 'parser']],
    ['user_id', ['user', 'id']],
    ['handlerV2', ['handler', 'v', '2']],
    ['decodeBase64', ['decode', 'base64']],
    ['I18N', ['i18n']],
] as const)(
    'splitWords splits %s at case changes, separators, and digit runs, and keeps an acronym or a number word as one word',
    (name, words) => {
        expect(splitWords(name)).toStrictEqual([...words]);
    },
);
