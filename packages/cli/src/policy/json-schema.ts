// gspot.schema.json from the zod schema, published with each release and submitted to SchemaStore.
import { z } from 'zod';
import { policySchema } from '#cli/policy/schema.ts';

const JSON_INDENT = 4;

/**
 * The JSON schema of gspot.toml as an object.
 * @returns the schema
 */
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

/**
 * The text written to schema/gspot.schema.json.
 * @returns the JSON text
 */
export function policyJsonSchemaText(): string {
    return `${JSON.stringify(policyJsonSchema(), null, JSON_INDENT)}\n`;
}
