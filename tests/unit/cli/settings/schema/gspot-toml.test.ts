import { z } from 'zod';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parseSettings } from '#cli/settings/read.ts';
import { settingsErrors } from '#tests/setup/settings.ts';
import { settingsJsonSchema } from '#cli/settings/schema/parts.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/config/settings/schema.ts';

const examples = z.array(z.unknown()).parse(settingsSchema.meta()?.['examples']);
const validate = new Ajv2020({ strict: false }).compile(settingsJsonSchema(settingsSchema));

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const errors = settingsErrors(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(validate(input)).toBe(valid);
});

test.each(examples)('schema example %j is a valid gspot.toml', (example) => {
    expect(() => parseSettings(stringify(example))).not.toThrow();
    expect(validate(example)).toBe(true);
});
