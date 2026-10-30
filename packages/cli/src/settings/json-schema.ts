import { z } from 'zod';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { RELATIVE_PATH_PATTERN } from '#cli/config/settings/fields.ts';

import {
    SCHEMA_URL,
    HIDDEN_FACT_KEYS,
    SCHEMA_DESCRIPTION,
    JSON_SCHEMA_DIALECT,
    PORTABLE_RELATIVE_PATH_PATTERN,
} from '#cli/config/settings/json-schema.ts';

function makeSchemaPatternsPortable(value: unknown): void {
    if (typeof value !== 'object' || value === null) return;
    const schema = value as Record<string, unknown>;
    if (schema['pattern'] === RELATIVE_PATH_PATTERN.source) schema['pattern'] = PORTABLE_RELATIVE_PATH_PATTERN;
    for (const child of Object.values(schema)) makeSchemaPatternsPortable(child);
}

/**
Build the editor schema for this gspot version.
*/
export function buildJsonSchema(): z.core.JSONSchema.JSONSchema {
    const converted = z.toJSONSchema(settingsSchema, {
        io: 'input',
        reused: 'ref',
        override: ({ zodSchema, jsonSchema }) => {
            if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
            for (const key of HIDDEN_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
            if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion) {
                delete jsonSchema['minimum'];
                jsonSchema.default = zodSchema.def.defaultValue;
            }
            const definition = z.globalRegistry.get(zodSchema);
            if (definition?.['examples'] !== undefined) Object.assign(jsonSchema, { examples: definition['examples'] });
        },
    });
    makeSchemaPatternsPortable(converted);
    return {
        $schema: JSON_SCHEMA_DIALECT,
        $id: SCHEMA_URL,
        title: SETTINGS_FILE,
        description: SCHEMA_DESCRIPTION,
        ...converted,
    };
}
