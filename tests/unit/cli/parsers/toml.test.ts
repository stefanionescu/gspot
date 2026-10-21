import { test, expect } from 'bun:test';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { openTomlFile, parseTomlFile } from '#cli/parsers/toml/document.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/dependencies/package-json.ts';

test('adding a root key keeps the leading comments on their table', () => {
    const document = openTomlFile(
        'tool.toml',
        '# Authored tool table.\n# Exact dependency choices.\n[install]\nexact = true\n',
    );
    document.set(['level'], 'all');
    expect(document.getText()).toBe(
        'level = "all"\n# Authored tool table.\n# Exact dependency choices.\n[install]\nexact = true\n',
    );
});

test("deleting a root key keeps separate comments and the next table's comments", () => {
    const document = openTomlFile(
        'tool.toml',
        '# A project note.\n\nlevel = "all"\n\n# Authored tool table.\n[install]\nexact = true # Exact version.\n',
    );
    document.set(['level'], undefined);
    expect(document.getText()).toBe(
        '# A project note.\n\n\n# Authored tool table.\n[install]\nexact = true # Exact version.\n',
    );
});

test('reading TOML values: nested tables, arrays, scalars and missing keys', () => {
    const document = openTomlFile('tool.toml', '[defaults]\nenabled = false\nvalues = [0, ""]\n');
    expect(document.getValue(['defaults', 'enabled'])).toBe(false);
    expect(document.getValue(['defaults', 'values', 0])).toBe(0);
    expect(document.getValue(['defaults', 'values', 1])).toBe('');
    expect(document.getValue(['defaults'])).toStrictEqual({ enabled: false, values: [0, ''] });
    expect(document.getValue(['missing', 'enabled'])).toBeUndefined();
    expect(document.getValue(['defaults', 'enabled', 'missing'])).toBeUndefined();
    document.set(['defaults', 'enabled'], true);
    expect(document.getValue(['defaults', 'enabled'])).toBe(true);
});

test('a TOML syntax error is a GspotError that names the file and keeps the parser error as its cause', () => {
    expect(() => openTomlFile('apps/api/bunfig.toml', '[install\n')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: 'apps/api/bunfig.toml:1:9 is not valid TOML: Error parsing TOML (1, 9):. Fix the file.',
            cause: expect.any(Error),
        }),
    );
});

test('a TOML edit names the file when a scalar is in the way of a table', () => {
    const source = 'install = false\n';
    const document = openTomlFile('apps/api/bunfig.toml', source);
    expect(() => {
        document.set(['install', 'minimumReleaseAge'], 604_800);
    }).toThrow(
        'apps/api/bunfig.toml has a TOML field that is not a table: install. Fix the field, then run gspot apply.',
    );
    expect(document.getText()).toBe(source);
});

test('TOML edits keep dates, array order and keys named like object properties', () => {
    const source = '# Release timestamp\npublished = 2026-10-06T00:00:00Z\n';
    const document = openTomlFile('tool.toml', source);
    const entries = [Object.fromEntries([['constructor', 'first']]), { Object: 'second' }];
    document.set(['copied'], document.getValue(['published']));
    document.set(['metadata', 'entries'], entries);
    const text = document.getText();
    expect(text.startsWith(source)).toBe(true);
    expect(Reflect.get(Bun.TOML.parse(text), 'metadata')).toStrictEqual({ entries });
    expect(document.getValue(['copied'])).toBeInstanceOf(Date);
});

test('TOML schema failures name the source file and the field', () => {
    expect(() => parseTomlFile('package.toml', 'name = 42', packageJsonSchema)).toThrow(
        matchFields<GspotError>({ code: 'filesystem', message: matchSubstring('package.toml: name:') }),
    );
});
