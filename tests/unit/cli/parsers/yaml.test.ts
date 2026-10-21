import { test, expect } from 'bun:test';
import { parseYamlFile } from '#cli/parsers/yaml.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { packageJsonSchema } from '#cli/schemas/parsers/dependencies/package-json.ts';

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
            message: matchSubstring('apps/api/compose.yaml is not valid YAML:'),
            cause: expect.any(Error),
        }),
    );
});

test('YAML schema failures name the source file and the field', () => {
    expect(() => parseYamlFile('package.yaml', 'name: 42', packageJsonSchema)).toThrow(
        matchFields<GspotError>({ code: 'filesystem', message: matchSubstring('package.yaml: name:') }),
    );
    expect(parseYamlFile('package.yaml', 'name: example', packageJsonSchema)).toStrictEqual({ name: 'example' });
});
