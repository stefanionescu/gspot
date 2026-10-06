import { test, expect } from 'bun:test';
import { openTomlDocument } from '#cli/parsers/toml/document.ts';

test('TOML field reads preserve nested tables, arrays, scalars, and missing keys', () => {
    const document = openTomlDocument({ path: 'tool.toml', source: '[defaults]\nenabled = false\nvalues = [0, ""]\n' });
    expect(document.value(['defaults', 'enabled'])).toBe(false);
    expect(document.value(['defaults', 'values', 0])).toBe(0);
    expect(document.value(['defaults', 'values', 1])).toBe('');
    expect(document.value(['defaults'])).toStrictEqual({ enabled: false, values: [0, ''] });
    expect(document.value(['missing', 'enabled'])).toBeUndefined();
    expect(document.value(['defaults', 'enabled', 'missing'])).toBeUndefined();
    document.set(['defaults', 'enabled'], true);
    expect(document.value(['defaults', 'enabled'])).toBe(true);
});

test('TOML syntax errors name the file and retain the parser cause', () => {
    expect.assertions(3);
    try {
        openTomlDocument({ path: 'apps/api/bunfig.toml', source: '[install\n' });
    } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (!(error instanceof Error)) throw error;
        expect(error.message).toBe('apps/api/bunfig.toml is not valid TOML. Fix the file, then run gspot apply.');
        expect(error.cause).toBeInstanceOf(Error);
    }
});

test('TOML edits name the file when an authored scalar blocks a required table', () => {
    const source = 'install = false\n';
    const document = openTomlDocument({ path: 'apps/api/bunfig.toml', source });
    expect(() => {
        document.set(['install', 'minimumReleaseAge'], 604_800);
    }).toThrow(
        'apps/api/bunfig.toml has a TOML field that is not a table: install. Fix the field, then run gspot apply.',
    );
    expect(document.text()).toBe(source);
});

test('TOML table edits preserve authored dates, array order, and prototype-named fields', () => {
    const source = '# Release timestamp\npublished = 2026-10-06T00:00:00Z\n';
    const document = openTomlDocument({ path: 'tool.toml', source });
    const entries = [
        Object.fromEntries([
            ['__proto__', 'authored data'],
            ['constructor', 'first'],
        ]),
        { constructor: 'second' },
    ];
    document.set(['copied'], document.value(['published']));
    document.set(['metadata', 'entries'], entries);
    const text = document.text();
    expect(text.startsWith(source)).toBe(true);
    expect(Reflect.get(Bun.TOML.parse(text), 'metadata')).toStrictEqual({ entries });
    expect(document.value(['copied'])).toBeInstanceOf(Date);
});
