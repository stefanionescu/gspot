import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';

test('TOML schema failures name the source file and the field', () => {
    expect(() => parseTomlFile('package.toml', 'name = 42', packageJsonSchema)).toThrow(
        matchFields<GspotError>({
            code: 'parse',
            message: expect.stringContaining('package.toml: name:') as string,
        }),
    );
});
