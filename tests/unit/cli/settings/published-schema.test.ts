import { test, expect } from 'bun:test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { stringify } from '@decimalturn/toml-patch';
import { validateSettingsText } from '#tests/setup/settings.ts';
import { buildJsonSchema } from '#cli/settings/schema/gspot-toml.ts';
import { ISO_DATE, PUBLISHED_SCHEMA_CASES } from '#tests/data/settings/schema.ts';

const publishedSettingsValidator = new Ajv2020({
    strict: true,
    // Commands require one program name and accept any number of arguments.
    strictTuples: false,
    formats: {
        uri: (value: string) => URL.canParse(value),
        date: (value: string) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)),
    },
}).compile(buildJsonSchema());

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const errors = validateSettingsText(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(publishedSettingsValidator(input)).toBe(valid);
});

// The docs build reads the schema in memory, so a key that JSON drops must not hide a description there.
test('the schema in memory matches its published JSON', () => {
    const schema = buildJsonSchema();
    const published = JSON.stringify(schema);

    expect(schema).toStrictEqual(JSON.parse(published) as typeof schema);
});

test('published definitions omit internal metadata', () => {
    const definitions = buildJsonSchema()['$defs'] as Record<string, Record<string, unknown>>;
    for (const definition of Object.values(definitions)) {
        expect(definition).not.toHaveProperty('languages');
        expect(definition).not.toHaveProperty('categories');
        expect(definition).not.toHaveProperty('reason_values');
    }
});
