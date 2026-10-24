import { Ajv2020 } from 'ajv/dist/2020.js';
import { buildJsonSchema } from '#cli/settings/json-schema.ts';

const schemaText = JSON.stringify(buildJsonSchema());

export const isPublishedSettings = new Ajv2020({
    strict: true,
    strictTuples: false,
    formats: {
        uri: (value: string) => URL.canParse(value),
    },
}).compile(JSON.parse(schemaText) as object);
