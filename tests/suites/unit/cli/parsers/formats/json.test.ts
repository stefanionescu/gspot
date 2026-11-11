import { expect, test } from 'bun:test';

import { openJsonFile, parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('a JSON syntax error names its line and column in package.json', () => {
    expect(() => parseJsonFile('package.json', '{')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('package.json:1:2') as string,
        }),
    );
});

test('a JSON file may begin with one byte order mark', () => {
    expect(parseJsonFile('example.json', '\u{FEFF}{"name":"project"}')).toStrictEqual({ name: 'project' });
    const file = openJsonFile('example.json', '\u{FEFF}{"name":"project"}');
    file.set(['name'], 'renamed');
    expect(file.getText()).toBe('\u{FEFF}{"name":"renamed"}');
});
