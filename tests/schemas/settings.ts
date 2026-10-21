import { Ajv2020 } from 'ajv/dist/2020.js';
import { ISO_DATE } from '#tests/data/settings/schema.ts';
import { buildJsonSchema } from '#cli/schemas/settings/gspot-toml.ts';

export const publishedSettingsValidator = new Ajv2020({
    strict: true,
    // Commands require one program name and accept any number of arguments.
    strictTuples: false,
    formats: {
        uri: (value: string) => URL.canParse(value),
        date: (value: string) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)),
    },
}).compile(buildJsonSchema());
