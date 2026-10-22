import { Ajv2020 } from 'ajv/dist/2020.js';
import { ISO_DATE } from '#tests/config/settings/schema.ts';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';

export const publishedSettingsValidator = new Ajv2020({
    strict: true,
    // Commands require one program name and accept any number of arguments.
    strictTuples: false,
    formats: {
        uri: (value: string) => URL.canParse(value),
        date: (value: string) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)),
    },
}).compile(buildJsonSchema());
