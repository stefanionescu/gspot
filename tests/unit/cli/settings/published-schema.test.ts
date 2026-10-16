import { z } from 'zod';
import { test, expect } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { stringify } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { validateSettingsText } from '#tests/setup/settings.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/data/settings/schema.ts';
import { settingsSchema, buildJsonSchema } from '#cli/settings/schema/gspot-toml.ts';

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const validate = buildPublishedValidator();

    const errors = validateSettingsText(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(validate(input)).toBe(valid);
});

test.each(z.array(z.unknown()).parse(settingsSchema.meta()?.['examples']))(
    'schema example %j is a valid gspot.toml',
    (example) => {
        const validate = buildPublishedValidator();

        expect(() => parseSettings(stringify(example), undefined, createReadCache(process.cwd()))).not.toThrow();
        expect(validate(example)).toBe(true);
    },
);

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
