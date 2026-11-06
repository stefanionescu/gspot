import { z } from 'zod';

import { DOCS_PATHS } from '#cli/config/manifests.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { HIDDEN_FACT_KEYS, JSON_SCHEMA_DIALECT, SCHEMA_DESCRIPTION } from '#cli/config/settings/schema.ts';
import { listCheckIds, readConfigurations } from '#cli/manifests/read.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { compareText } from '#cli/system/text.ts';

/**
Copy the examples of a setting into its converted schema. A configuration name may only be a shipped name, and a check
ID gets the shipped IDs as examples, because a command check may add its own.
*/
function copySchemaExamples(zodSchema: z.core.$ZodType, jsonSchema: z.core.JSONSchema.BaseSchema): void {
    const definition = z.globalRegistry.get(zodSchema);
    if (definition?.['examples'] !== undefined) Object.assign(jsonSchema, { examples: definition['examples'] });
    if (definition?.['value_names'] === 'configurations')
        jsonSchema.enum = readConfigurations().keys().toArray().toSorted(compareText);
    if (definition?.['value_names'] === 'checks') jsonSchema.examples = listCheckIds([]);
}

function normalizeSchemaNode(zodSchema: z.core.$ZodType, jsonSchema: z.core.JSONSchema.BaseSchema): void {
    if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
    for (const key of HIDDEN_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
    if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion) {
        delete jsonSchema['minimum'];
        delete jsonSchema['maximum'];
        jsonSchema.default = zodSchema.def.defaultValue;
    }
    copySchemaExamples(zodSchema, jsonSchema);
}

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
