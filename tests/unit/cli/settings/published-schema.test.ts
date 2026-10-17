import { test, expect } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { stringify } from '@decimalturn/toml-patch';
import { validateSettingsText } from '#tests/setup/settings.ts';
import { buildJsonSchema } from '#cli/settings/schema/gspot-toml.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/data/settings/schema.ts';

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const validate = buildPublishedValidator();

    const errors = validateSettingsText(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(validate(input)).toBe(valid);
});

function buildPublishedValidator() {
    const validator = new Ajv2020({
        strict: false,
        formats: {
            uri: (value: string) => URL.canParse(value),
            date: (value: string) => /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(Date.parse(value)),
        },
    });
    return validator.compile(buildJsonSchema());
}
