import { expect, test } from 'bun:test';

import { openJsonFile, parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { SYNTAX_ERRORS } from '#tests/config/parsers/formats.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test.each(SYNTAX_ERRORS)('a JSON syntax error names its line and column in $path', ({ path, source, position }) => {
    expect(() => parseJsonFile(path, source)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining(position) as string,
        }),
    );
});

test('a JSON file may begin with one byte order mark', () => {
    expect(parseJsonFile('example.json', '\u{FEFF}{"name":"project"}')).toStrictEqual({ name: 'project' });
    const file = openJsonFile('example.json', '\u{FEFF}{"name":"project"}');
    file.set(['name'], 'renamed');
    expect(file.getText()).toBe('\u{FEFF}{"name":"renamed"}');
});
