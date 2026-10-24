import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';
import { isPublishedSettings } from '#tests/schemas/settings.ts';
import { validateSettingsText } from '#tests/setup/cli/settings.ts';
import { PUBLISHED_SCHEMA_CASES } from '#tests/config/settings/json-schema.ts';

test.each([...PUBLISHED_SCHEMA_CASES])('runtime and published schemas agree on $name', ({ input, valid }) => {
    const errors = validateSettingsText(stringify(input));
    expect(errors.length === 0).toBe(valid);
    expect(isPublishedSettings(input)).toBe(valid);
});

test('the published schema strips internal reason conditions', () => {
    expect(JSON.stringify(buildJsonSchema())).not.toContain('"reason_when":');
});
