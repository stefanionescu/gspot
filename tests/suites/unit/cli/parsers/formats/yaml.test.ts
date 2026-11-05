import { expect, test } from 'bun:test';

import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

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
