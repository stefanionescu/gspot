import { z } from 'zod';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { localDateSchema } from '#cli/schemas/settings/fields.ts';

import {
    SCHEMA_URL,
    TABLE_DESCRIPTIONS,
    INTERNAL_FACT_KEYS,
    JSON_SCHEMA_DIALECT,
} from '#cli/config/settings/json-schema.ts';

/**
Build the editor schema for this gspot version.

@returns the JSON Schema document.
*/
export function buildJsonSchema(): Record<string, unknown> {
    const converted = convertToJsonSchema(settingsSchema);
    const properties = Object.entries(converted.properties as Record<string, z.core.JSONSchema.JSONSchema>).map(
        ([name, node]) => {
            const description = node.description ?? TABLE_DESCRIPTIONS[name];
            return [name, description === undefined ? node : { ...node, description }];
        },
    );
    return {
        $schema: JSON_SCHEMA_DIALECT,
        $id: SCHEMA_URL,
        title: SETTINGS_FILE,
        description: 'The settings of gspot for one repository.',
        ...converted,
        properties: Object.fromEntries(properties),
    };
}
function convertToJsonSchema(schema: z.ZodType): z.core.JSONSchema.JSONSchema {
    return z.toJSONSchema(schema, {
        io: 'input',
        reused: 'ref',
        unrepresentable: ({ zodSchema }) =>
            zodSchema === localDateSchema
                ? { description: 'An unquoted TOML date in YYYY-MM-DD form, such as 2026-11-08.' }
                : 'throw',
        override: ({ zodSchema, jsonSchema }) => {
            if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
            for (const key of INTERNAL_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
            if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion)
                jsonSchema.default = zodSchema.def.defaultValue;
            const definition = z.globalRegistry.get(zodSchema);
            if (definition && Object.hasOwn(definition, 'examples'))
                Object.assign(jsonSchema, { examples: definition['examples'] });
        },
    });
}
