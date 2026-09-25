import { configurationManifests } from '#cli/configurations/manifests.ts';
import { policySchema, settingValueSchemas } from '#cli/policy/schema.ts';
import { z } from 'zod';

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

// Manifest settings own the exposed tool keys. Keep the richer schemas for rule tables and
// adoption records, and close the surrounding tables so removed settings cannot remain valid.
function toolSettings(schema: SchemaNode): void {
    const tools = schema.properties?.['tools'];
    if (tools === undefined) return;
    const fallback = tools.additionalProperties;
    if (typeof fallback !== 'object') throw new Error('The policy tools schema requires a tool table.');
    tools.properties ??= {};
    for (const manifest of configurationManifests().values()) {
        for (const spec of manifest.settings) {
            const [root, tool, ...segments] = spec.name.split('.');
            if (root !== 'tools' || tool === undefined) continue;
            const value = settingValueSchemas[spec.kind];
            const leaf = z.toJSONSchema(z.union([value, z.strictObject({ value, reason: z.string().optional() })]));
            let table = (tools.properties[tool] ??= structuredClone(fallback));
            for (const [index, segment] of segments.entries()) {
                table.properties ??= {};
                table.additionalProperties = false;
                table = table.properties[segment] ??=
                    index === segments.length - 1
                        ? (leaf as SchemaNode)
                        : { type: 'object', properties: {}, additionalProperties: false };
            }
        }
    }
    fallback.additionalProperties = false;
    for (const table of Object.values(tools.properties)) table.additionalProperties = false;
}

/**
 * The JSON schema of gspot.toml as an object.
 * @returns the schema
 */
export function policyJsonSchema(): Record<string, unknown> {
    const schema = z.toJSONSchema(policySchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    toolSettings(schema);
    const scope = (schema as SchemaNode).properties?.['scope']?.items;
    if (scope !== undefined) toolSettings(scope);
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

/** A node of the published JSON schema, as the loader walks it to name the keys a table accepts. */
export type SchemaNode = {
    type?: string;
    properties?: Record<string, SchemaNode>;
    items?: SchemaNode;
    additionalProperties?: SchemaNode | boolean;
    anyOf?: SchemaNode[];
};
