import { test, expect } from 'bun:test';
import { escapeRegExp } from '#cli/system/text.ts';

test('an escaped text matches itself in a Unicode pattern, and each syntax character stays literal', () => {
    const text = String.raw`a.b*c+d?e^f$g{h}i(j)k|l[m]n\o/p-q`;
    expect(new RegExp(`^${escapeRegExp(text)}$`, 'u').test(text)).toBe(true);
    expect(new RegExp(`^${escapeRegExp('a.b')}$`, 'u').test('axb')).toBe(false);
});
