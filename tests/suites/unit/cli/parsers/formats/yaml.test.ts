import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { parseYamlFile } from '#cli/parsers/formats/yaml.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/projects/dependencies.ts';

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
            code: 'filesystem',
            message:
                'apps/api/compose.yaml is not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 1, column 7. Fix the file.',
            cause: expect.any(Error),
        }),
    );
});

test('YAML schema failures name the source file and the field', () => {
    expect(() => parseYamlFile('package.yaml', 'name: 42', packageJsonSchema)).toThrow(
        matchFields<GspotError>({
            code: 'filesystem',
            message: 'package.yaml: name: Invalid input: expected string, received number. Fix the field.',
        }),
    );
    expect(parseYamlFile('package.yaml', 'name: example', packageJsonSchema)).toStrictEqual({ name: 'example' });
});
