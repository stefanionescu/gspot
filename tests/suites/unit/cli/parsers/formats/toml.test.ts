import { expect, test } from 'bun:test';

import { openTomlFile, parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('adding a root key keeps the leading comments on their table', () => {
    const document = openTomlFile(
        'tool.toml',
        '# Authored tool table.\n# Exact dependency choices.\n[install]\nexact = true\n',
    );
    document.set(['level'], 'all');
    expect(document.getText()).toBe(
        'level = "all"\n\n# Authored tool table.\n# Exact dependency choices.\n[install]\nexact = true\n',
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

test('a TOML syntax error is a GspotError that names the file and keeps the parser error as its cause', () => {
    expect(() => openTomlFile('apps/api/bunfig.toml', '[install\n')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('apps/api/bunfig.toml:1:9') as string,
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
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('apps/api/bunfig.toml') as string,
        }),
    );
    expect(document.getText()).toBe(source);
});

test('TOML edits keep dates, array order and keys named like object properties', () => {
    const source = '# Release timestamp\npublished = 2026-10-06T00:00:00Z\n';
    const document = openTomlFile('tool.toml', source);
    const values = [Object.fromEntries([['constructor', 'first']]), { Object: 'second' }];
    document.set(['copied'], document.getValue(['published']));
    document.set(['metadata', 'entries'], values);
    const text = document.getText();
    expect(text).toStartWith(source);
    expect(Reflect.get(Bun.TOML.parse(text), 'metadata')).toStrictEqual({ entries: values });
    expect(document.getValue(['copied'])).toStrictEqual(new Date('2026-10-06T00:00:00Z'));
});

test('TOML schema failures name the source file and the field', () => {
    expect(() => parseTomlFile('package.toml', 'name = 42', packageJsonSchema)).toThrow(
        matchFields<GspotError>({
            code: 'parse',
            message: expect.stringContaining('package.toml: name:') as string,
        }),
    );
});
