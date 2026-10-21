import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { validateSettingsText } from '#tests/setup/settings.ts';
import { buildJsonSchema } from '#cli/schemas/settings/gspot-toml.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/data/settings/schema.ts';
import { publishedSettingsValidator } from '#tests/schemas/settings.ts';

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
