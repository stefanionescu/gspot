import { test, expect } from 'bun:test';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { NON_TABLE_JSON } from '#tests/data/checks/format.ts';

test.each(NON_TABLE_JSON)(
    'a JSON file whose root is %s, not an object, fails with an error that names the file and the shape',
    (text) => {
        expect(() => parseJsonFile('example.json', text)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'filesystem',
                message: 'example.json must contain a JSON object. Fix the file.',
            }),
        );
    },
);

test('a JSON syntax error names the file and keeps the parser error as its cause', () => {
    expect(() => parseJsonFile('package.json', '{')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'filesystem',
            message: 'package.json is not valid JSON: Invalid JSON at offset 1: CloseBraceExpected. Fix the file.',
            cause: expect.any(SyntaxError),
        }),
    );
});

test('JSON with comments names the error offset', () => {
    expect(() => parseJsonFile('bun.lock', '{"value": }')).toThrow(
        'bun.lock is not valid JSON: Invalid JSON at offset 10: ValueExpected. Fix the file.',
    );
});

test('JSON files accept comments and trailing commas without a JSONC extension', () => {
    expect(parseJsonFile('package.json', '// Authored comment\n{ "name": "example", }')).toStrictEqual({
        name: 'example',
    });
});
