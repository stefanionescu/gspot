import { z } from 'zod';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { localDateSchema } from '#cli/schemas/settings/fields.ts';

import {
    SCHEMA_URL,
    HIDDEN_FACT_KEYS,
    SCHEMA_DESCRIPTION,
    JSON_SCHEMA_DIALECT,
    LOCAL_DATE_DESCRIPTION,
} from '#cli/config/settings/json-schema.ts';

/**
Build the editor schema for this gspot version.
*/
export function buildJsonSchema(): z.core.JSONSchema.JSONSchema {
    const converted = z.toJSONSchema(settingsSchema, {
        io: 'input',
        reused: 'ref',
        unrepresentable: ({ zodSchema }) =>
            zodSchema === localDateSchema ? { description: LOCAL_DATE_DESCRIPTION } : 'throw',
        override: ({ zodSchema, jsonSchema }) => {
            if (zodSchema instanceof z.ZodArray && jsonSchema.$ref !== undefined) jsonSchema.type = 'array';
            for (const key of HIDDEN_FACT_KEYS) Reflect.deleteProperty(jsonSchema, key);
            if (zodSchema instanceof z.ZodDefault && zodSchema.def.innerType instanceof z.ZodUnion) {
                Reflect.deleteProperty(jsonSchema, 'minimum');
                jsonSchema.default = zodSchema.def.defaultValue;
            }
            const definition = z.globalRegistry.get(zodSchema);
            if (definition && Object.hasOwn(definition, 'examples'))
                Object.assign(jsonSchema, { examples: definition['examples'] });
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
