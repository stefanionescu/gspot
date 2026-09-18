// gspot.schema.json from the zod schema, published with each release and submitted to SchemaStore.
import { z } from 'zod';

import { policySchema } from '#cli/policy/schema.ts';

/** The JSON schema of gspot.toml as an object. */
export function policyJsonSchema(): Record<string, unknown> {
    const schema = z.toJSONSchema(policySchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://gspot.dev/schema/gspot.schema.json',
        title: 'gspot.toml',
        description:
            'The policy of one repository under gspot: presets, scopes, limits, naming, tools, ignores, declarations and hooks.',
        ...schema,
    };
}

/** The text written to schema/gspot.schema.json. */
export function policyJsonSchemaText(): string {
    return `${JSON.stringify(policyJsonSchema(), null, 4)}\n`;
}
