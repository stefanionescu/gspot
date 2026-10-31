import { z } from 'zod';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { SCHEMA_URL, HIDDEN_FACT_KEYS, SCHEMA_DESCRIPTION, JSON_SCHEMA_DIALECT } from '#cli/config/settings/schema.ts';

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
    return {
        $schema: JSON_SCHEMA_DIALECT,
        $id: SCHEMA_URL,
        title: SETTINGS_FILE,
        description: SCHEMA_DESCRIPTION,
        ...converted,
    };
}
