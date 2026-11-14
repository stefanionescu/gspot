import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { parseYamlFile, parseYamlPositions } from '#cli/parsers/formats/yaml.ts';

test('YAML files resolve merge keys before returning the document', () => {
    expect(parseYamlFile('compose.yaml', 'base: &base {name: example}\ncopy: {<<: *base}\n')).toStrictEqual({
        base: { name: 'example' },
        copy: { name: 'example' },
    });
});

test('YAML syntax errors name the file and keep the parser failure', () => {
    expect(() => parseYamlFile('apps/api/compose.yaml', 'key: [')).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'parse',
            message: expect.stringContaining('apps/api/compose.yaml') as string,
            cause: expect.any(Error),
        }),
    );
});

test('YAML positions keep each document, its syntax errors, and the line and column of an offset', () => {
    const text = 'first: 1\n---\nsecond:\n  - [\n';
    const { documents, findPosition } = parseYamlPositions(text);
    expect(documents.map((document) => document.errors.length > 0)).toStrictEqual([false, true]);
    expect(findPosition(text.indexOf('second'))).toStrictEqual({ line: 3, col: 1 });
    expect(findPosition(text.indexOf('['))).toStrictEqual({ line: 4, col: 5 });
    expect(findPosition(undefined)).toStrictEqual({ line: 1, col: 1 });
});
