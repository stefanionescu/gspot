import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';

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
            message:
                'apps/api/compose.yaml is not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 7. Fix the file.',
            cause: expect.any(Error),
        }),
    );
});
