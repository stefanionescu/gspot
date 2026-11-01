import { test, expect } from 'bun:test';
import { formatScope, escapeRegExp, formatNameList } from '#cli/system/text.ts';

test('an escaped text matches itself in a Unicode pattern, and each syntax character stays literal', () => {
    const text = String.raw`a.b*c+d?e^f$g{h}i(j)k|l[m]n\o/p-q`;
    expect(new RegExp(`^${escapeRegExp(text)}$`, 'u').test(text)).toBe(true);
    expect(new RegExp(`^${escapeRegExp('a.b')}$`, 'u').test('axb')).toBe(false);
});

test.each([
    { names: ['a'], type: undefined, joined: 'a' },
    { names: ['a', 'b'], type: undefined, joined: 'a and b' },
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
