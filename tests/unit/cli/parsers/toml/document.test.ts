import { test, expect } from 'bun:test';
import { containing } from '#tests/setup/matchers.ts';
import { openTomlFile } from '#cli/parsers/toml/document.ts';

test('adding a root key keeps the leading comments on their table', () => {
    const document = openTomlFile({
        path: 'tool.toml',
        source: '# Authored tool table.\n# Exact dependency choices.\n[install]\nexact = true\n',
    });
    document.set(['level'], 'all');
    expect(document.text()).toBe(
        'level = "all"\n# Authored tool table.\n# Exact dependency choices.\n[install]\nexact = true\n',
    );
});

test("deleting a root key keeps separate comments and the next table's comments", () => {
    const document = openTomlFile({
        path: 'tool.toml',
        source: '# A project note.\n\nlevel = "all"\n\n# Authored tool table.\n[install]\nexact = true # Exact version.\n',
    });
    document.set(['level'], undefined);
    expect(document.text()).toBe(
        '# A project note.\n\n\n# Authored tool table.\n[install]\nexact = true # Exact version.\n',
    );
});

test('reading TOML values: nested tables, arrays, scalars and missing keys', () => {
    const document = openTomlFile({ path: 'tool.toml', source: '[defaults]\nenabled = false\nvalues = [0, ""]\n' });
    expect(document.value(['defaults', 'enabled'])).toBe(false);
    expect(document.value(['defaults', 'values', 0])).toBe(0);
    expect(document.value(['defaults', 'values', 1])).toBe('');
    expect(document.value(['defaults'])).toStrictEqual({ enabled: false, values: [0, ''] });
    expect(document.value(['missing', 'enabled'])).toBeUndefined();
    expect(document.value(['defaults', 'enabled', 'missing'])).toBeUndefined();
    document.set(['defaults', 'enabled'], true);
    expect(document.value(['defaults', 'enabled'])).toBe(true);
});

test('a TOML syntax error names the file and keeps the parser error as its cause', () => {
    expect(() => openTomlFile({ path: 'apps/api/bunfig.toml', source: '[install\n' })).toThrow(Error);
    expect(() => openTomlFile({ path: 'apps/api/bunfig.toml', source: '[install\n' })).toThrow(
        containing<Error>({
            message: 'apps/api/bunfig.toml is not valid TOML. Fix the file, then run gspot apply.',
            cause: expect.any(Error),
        }),
    );
});

test('a TOML edit names the file when a scalar is in the way of a table', () => {
    const source = 'install = false\n';
    const document = openTomlFile({ path: 'apps/api/bunfig.toml', source });
    expect(() => {
        document.set(['install', 'minimumReleaseAge'], 604_800);
    }).toThrow(
        'apps/api/bunfig.toml has a TOML field that is not a table: install. Fix the field, then run gspot apply.',
    );
    expect(document.text()).toBe(source);
});

test('TOML edits keep dates, array order and keys named like object properties', () => {
    const source = '# Release timestamp\npublished = 2026-10-06T00:00:00Z\n';
    const document = openTomlFile({ path: 'tool.toml', source });
    const entries = [Object.fromEntries([['constructor', 'first']]), { constructor: 'second' }];
    document.set(['copied'], document.value(['published']));
    document.set(['metadata', 'entries'], entries);
    const text = document.text();
    expect(text.startsWith(source)).toBe(true);
    expect(Reflect.get(Bun.TOML.parse(text), 'metadata')).toStrictEqual({ entries });
    expect(document.value(['copied'])).toBeInstanceOf(Date);
});
