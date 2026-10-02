import { z } from 'zod';
import { kitManifests } from '#cli/kits/manifests.ts';
import type { SchemaNode } from '#cli/types/policy/policy.ts';
import { policySchema, settingValueSchemas } from '#cli/policy/schema.ts';

function addSetting(root: SchemaNode, segments: string[], leaf: SchemaNode): void {
    let table = root;
    for (const [index, segment] of segments.entries()) {
        table.properties ??= {};
        table.additionalProperties = false;
        table = table.properties[segment] ??=
            index === segments.length - 1 ? leaf : { type: 'object', properties: {}, additionalProperties: false };
    }
}

// Manifest settings own the exposed tool keys. Keep the richer schemas for rule tables, and close
// the surrounding tables so removed settings cannot remain valid.
function closeToolTables(schema: SchemaNode): void {
    const tools = schema.properties?.['tools'];
    if (tools === undefined) return;
    const toolSchema = tools.additionalProperties;
    if (typeof toolSchema !== 'object') throw new Error('The policy tools schema requires a tool table.');
    tools.properties ??= {};
    const settings = [...kitManifests().values()].flatMap((manifest) => manifest.settings);
    const declared = settings.flatMap((spec) => {
        const [root, tool, ...segments] = spec.name.split('.');
        if (root !== 'tools' || tool === undefined) return [];
        const value = settingValueSchemas[spec.type];
        const leaf = z.toJSONSchema(z.union([value, z.strictObject({ value, reason: z.string().optional() })]));
        return [{ tool, segments, leaf }];
    });
    for (const { tool, segments, leaf } of declared) {
        const table = (tools.properties[tool] ??= structuredClone(toolSchema));
        addSetting(table, segments, leaf as SchemaNode);
    }
    toolSchema.additionalProperties = false;
    for (const table of Object.values(tools.properties)) table.additionalProperties = false;
}

/**
 * The JSON schema of gspot.toml as an object.
 * @returns the schema
 */
export function buildJsonSchema(): Record<string, unknown> {
    const schema = z.toJSONSchema(policySchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    closeToolTables(schema);
    const scope = (schema as SchemaNode).properties?.['scope']?.items;
    if (scope !== undefined) closeToolTables(scope);
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'https://gspot.dev/schema/gspot.schema.json',
        title: 'gspot.toml',
        description:
            'The policy of one repository under gspot: kits, scopes, limits, naming, tools, ignores, declarations and hooks.',
        ...schema,
    };
}
