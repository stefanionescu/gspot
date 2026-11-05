import { expect, test } from 'bun:test';

import { openJsonFile, parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { SYNTAX_ERRORS } from '#tests/config/parsers/formats.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test.each(['null', '[]'])(
    'a JSON file whose root is %s, not an object, fails with an error that names the file and the shape',
    (text) => {
        expect(() => parseJsonFile('example.json', text)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message: expect.stringContaining('example.json') as string,
            }),
        );
    },
);

test.each(SYNTAX_ERRORS)('a JSON syntax error names its line and column in $path', ({ path, source, position }) => {
    expect(() => parseJsonFile(path, source)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining(position) as string,
        }),
    );
});

test('JSON files accept comments and trailing commas without a JSONC extension', () => {
    expect(parseJsonFile('package.json', '// Authored comment\n{ "name": "example", }')).toStrictEqual({
        name: 'example',
    });
});

test('a JSON file may begin with one byte order mark', () => {
    expect(parseJsonFile('example.json', '\u{FEFF}{"name":"project"}')).toStrictEqual({ name: 'project' });
    const file = openJsonFile('example.json', '\u{FEFF}{"name":"project"}');
    file.set(['name'], 'renamed');
    expect(file.getText()).toBe('\u{FEFF}{"name":"renamed"}');
    expect(parseJsonFile('example.json', file.getText())).toStrictEqual({ name: 'renamed' });
});
