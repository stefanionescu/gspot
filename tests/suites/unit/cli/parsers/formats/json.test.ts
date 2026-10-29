import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { SYNTAX_ERRORS } from '#tests/config/parsers/formats/json.ts';

test.each(['null', '[]', '42'])(
    'a JSON file whose root is %s, not an object, fails with an error that names the file and the shape',
    (text) => {
        expect(() => parseJsonFile('example.json', text)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message: 'example.json must contain a JSON object. Fix the file.',
            }),
        );
    },
);

test.each(SYNTAX_ERRORS)('a JSON syntax error names its line and column in $path', ({ path, source, message }) => {
    expect(() => parseJsonFile(path, source)).toThrow(new Error(message));
});

test('JSON files accept comments and trailing commas without a JSONC extension', () => {
    expect(parseJsonFile('package.json', '// Authored comment\n{ "name": "example", }')).toStrictEqual({
        name: 'example',
    });
});

test('a JSON file may begin with one byte order mark', () => {
    expect(parseJsonFile('example.json', '\uFEFF{"name":"project"}')).toStrictEqual({ name: 'project' });
});
