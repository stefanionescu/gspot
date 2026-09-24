// gspot.schema.json from the zod schema, published with each release and submitted to SchemaStore.
import { z } from 'zod';
import type { SchemaNode } from '#cli/types/policy.ts';
import { policySchema } from '#cli/schemas/policy.ts';

const JSON_INDENT = 4;

function childrenAt(node: SchemaNode, segment: string | number): SchemaNode[] {
    const options = node.anyOf ?? [node];
    return options.flatMap((option) => {
        if (typeof segment === 'number') return option.items ? [option.items] : [];
        const named = option.properties?.[segment];
        if (named) return [named];
        return typeof option.additionalProperties === 'object' ? [option.additionalProperties] : [];
    });
}

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
            'The policy of one repository under gspot: configurations, scopes, limits, naming, tools, ignores, declarations and hooks.',
        ...schema,
    };
}

/**
 * The keys the policy schema accepts at a path, read from the published JSON schema.
 * @param path the path of a table, as zod reports it
 * @returns the key names, empty when the path holds no table
 */
export function knownKeysAt(path: (string | number)[]): string[] {
    let nodes: SchemaNode[] = [policyJsonSchema()];
    for (const segment of path) nodes = nodes.flatMap((node) => childrenAt(node, segment));
    const tables = nodes.flatMap((node) => node.anyOf ?? [node]);
    return [...new Set(tables.flatMap((node) => Object.keys(node.properties ?? {})))];
}

/**
 * The text written to gspot.schema.json.
 * @returns the JSON text
 */
export function policyJsonSchemaText(): string {
    return `${JSON.stringify(policyJsonSchema(), null, JSON_INDENT)}\n`;
}
