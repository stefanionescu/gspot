import type { JSONSchema } from 'zod/v4/core';
import { policyJsonSchema } from '@gspot/cli/src/policy/json-schema.ts';

function cell(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('|', '&#124;')
        .replaceAll('\n', ' ');
}

function constraints(node: JSONSchema.JSONSchema): string {
    const nested = new Set(['properties', 'items', 'anyOf', 'description']);
    const rest = Object.fromEntries(
        Object.entries(node).filter(
            ([key, value]) => !nested.has(key) && (key !== 'additionalProperties' || typeof value === 'boolean'),
        ),
    );
    return `<code>${cell(JSON.stringify(rest))}</code>`;
}

function rows(node: JSONSchema.JSONSchema | boolean, path: string, required: boolean): string[] {
    if (typeof node === 'boolean')
        return [
            `| <code>${cell(path)}</code> | ${required ? 'Required' : 'Optional'} | ${node ? 'Any value' : 'Not accepted'} | |`,
        ];
    const row = `| <code>${cell(path)}</code> | ${required ? 'Required' : 'Optional'} | ${constraints(node)} | ${cell(node.description ?? '')} |`;
    const properties = Object.entries(node.properties ?? {}).flatMap(([name, child]) =>
        rows(child, `${path}.${name}`, node.required?.includes(name) === true),
    );
    return [row, ...properties, ...arrayRows(node, path), ...variantRows(node, path, required)];
}

function arrayRows(node: JSONSchema.JSONSchema, path: string): string[] {
    if (node.items === undefined) return [];
    const items = Array.isArray(node.items) ? node.items : [node.items];
    return items.flatMap((child) => rows(child, `${path}[]`, false));
}

function variantRows(node: JSONSchema.JSONSchema, path: string, required: boolean): string[] {
    const alternatives = (node.anyOf ?? []).flatMap((child, index) =>
        rows(child, `${path} (form ${String(index + 1)})`, required),
    );
    const additional =
        typeof node.additionalProperties === 'object' ? rows(node.additionalProperties, `${path}.*`, false) : [];
    return [...alternatives, ...additional];
}

/**
 * Render all policy fields from the schema used by the production reader.
 * @returns Markdown reference tables
 */
export function configurationReference(): string {
    const schema: JSONSchema.JSONSchema = policyJsonSchema();
    const sections = Object.entries(schema.properties ?? {}).map(
        ([name, node]) =>
            `## ${name}\n\n| Field | Presence | Accepted structure and defaults | Meaning |\n| --- | --- | --- | --- |\n${rows(node, name, schema.required?.includes(name) === true).join('\n')}\n`,
    );
    return `The [machine-readable configuration schema](/schema/gspot.schema.json) defines these fields. Required means required within the containing table or array item. An optional table does not make its required children mandatory at the repository root.\n\n\`[]\` identifies an array item; \`*\` identifies a user-defined key. Alternative forms describe different accepted values for the same field. Constraints use JSON Schema notation, including \`enum\` for accepted values, \`default\` for schema defaults, and \`additionalProperties: false\` for tables that reject unknown keys.\n\nThe policy reader also validates selected presets, exposed settings, cross-field relationships, and required reasons. Use version 1 policies. See [scopes](/guides/scopes/) for inheritance and [settings](/reference/settings/) for preset-owned values.\n\n${sections.join('\n')}`;
}
