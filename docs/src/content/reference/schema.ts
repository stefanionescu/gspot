import { z } from 'zod';
import type { SchemaNode } from '../../types/reference.ts';
import { policySchema } from '@gspothq/cli/src/policy/schema/policy.ts';
import { JSON_SCHEMA_URL } from '@gspothq/cli/src/config/commands/init.ts';
import { settingValueSchema } from '@gspothq/cli/src/parsers/schema/settings.ts';
import type { SettingDeclaration } from '@gspothq/cli/src/types/configurations.ts';
import { STRUCTURED_POLICY_TABLES } from '@gspothq/cli/src/config/policy/settings.ts';
import { configurationManifests } from '@gspothq/cli/src/configurations/manifests.ts';

function addSetting(root: SchemaNode, segments: string[], leaf: SchemaNode): void {
    let table = root;
    for (const [index, segment] of segments.entries()) {
        table.properties ??= {};
        table.additionalProperties = false;
        table = table.properties[segment] ??=
            index === segments.length - 1 ? leaf : { type: 'object', properties: {}, additionalProperties: false };
    }
}

function closeConfigurationTables(schema: SchemaNode, settings: SettingDeclaration[]): void {
    const configurations = settings.flatMap((declaration) => {
        const [root, ...segments] = declaration.name.split('.');
        const table = root === undefined ? undefined : schema.properties?.[root];
        if (root === 'tools' || STRUCTURED_POLICY_TABLES.has(root ?? '') || table === undefined) return [];
        const value = settingValueSchema(declaration);
        const leaf = z.toJSONSchema(z.union([value, z.strictObject({ value, reason: z.string().optional() })]));
        return [{ table, segments, leaf }];
    });
    for (const { table, segments, leaf } of configurations) {
        addSetting(table, segments, leaf as SchemaNode);
        table.additionalProperties = false;
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
    const settings = [...configurationManifests().values()].flatMap((manifest) => manifest.settings);
    const declared = settings.flatMap((declaration) => {
        const [root, tool, ...segments] = declaration.name.split('.');
        if (root !== 'tools' || tool === undefined) return [];
        const value = settingValueSchema(declaration);
        const leaf = z.toJSONSchema(z.union([value, z.strictObject({ value, reason: z.string().optional() })]));
        return [{ tool, segments, leaf }];
    });
    for (const { tool, segments, leaf } of declared) {
        const table = (tools.properties[tool] ??= structuredClone(toolSchema));
        addSetting(table, segments, leaf as SchemaNode);
    }
    closeConfigurationTables(schema, settings);
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
        $id: JSON_SCHEMA_URL,
        title: 'gspot.toml',
        description: 'The settings of gspot for one repository in the latest release.',
        ...schema,
    };
}
