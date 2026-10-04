import { test, expect } from 'bun:test';
import { openTomlDocument } from '#cli/parsers/toml/document.ts';

test('TOML field reads preserve nested tables, arrays, scalars, and missing keys', () => {
    const document = openTomlDocument('[defaults]\nenabled = false\nvalues = [0, ""]\n');
    expect(document.value(['defaults', 'enabled'])).toBe(false);
    expect(document.value(['defaults', 'values', 0])).toBe(0);
    expect(document.value(['defaults', 'values', 1])).toBe('');
    expect(document.value(['defaults'])).toStrictEqual({ enabled: false, values: [0, ''] });
    expect(document.value(['missing', 'enabled'])).toBeUndefined();
    expect(document.value(['defaults', 'enabled', 'missing'])).toBeUndefined();
    document.set(['defaults', 'enabled'], true);
    expect(document.value(['defaults', 'enabled'])).toBe(true);
});
