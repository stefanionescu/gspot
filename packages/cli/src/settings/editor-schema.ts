import { z } from 'zod';
import { DOCS_PATHS } from '#cli/config/manifests.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { HIDDEN_FACT_KEYS, SCHEMA_DESCRIPTION, JSON_SCHEMA_DIALECT } from '#cli/config/settings/schema.ts';

/**
Edit the converted schema of one setting in place: hide the facts that only gspot reads, and keep the default and the
examples of the setting.

@param zodSchema the setting schema.
@param jsonSchema the converted schema, which this function changes.
*/
function normalizeSchemaNode(zodSchema: z.core.$ZodType, jsonSchema: z.core.JSONSchema.BaseSchema): void {
    if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
    for (const key of HIDDEN_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
    if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion) {
        delete jsonSchema['minimum'];
        delete jsonSchema['maximum'];
        jsonSchema.default = zodSchema.def.defaultValue;
    }
    const definition = z.globalRegistry.get(zodSchema);
    if (definition?.['examples'] !== undefined) Object.assign(jsonSchema, { examples: definition['examples'] });
}

/**
Build the editor schema for this gspot version.
*/
export function buildJsonSchema(): z.core.JSONSchema.JSONSchema {
    const converted = z.toJSONSchema(settingsSchema, {
        io: 'input',
        reused: 'ref',
        override: ({ zodSchema, jsonSchema }) => {
            normalizeSchemaNode(zodSchema, jsonSchema);
        },
    });
    return {
        $schema: JSON_SCHEMA_DIALECT,
        $id: DOCS_PATHS.schema,
        title: SETTINGS_FILE,
        description: SCHEMA_DESCRIPTION,
        ...converted,
    };
}
