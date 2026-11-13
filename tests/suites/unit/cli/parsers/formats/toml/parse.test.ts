import { expect, test } from 'bun:test';

import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('TOML schema failures name the source file and the field', () => {
    expect(() => parseTomlFile('package.toml', 'name = 42', packageJsonSchema)).toThrow(
        matchFields<GspotError>({
            code: 'parse',
            message: expect.stringContaining('package.toml: name:') as string,
        }),
    );
});
