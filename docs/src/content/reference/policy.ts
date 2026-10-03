import type { JSONSchema } from 'zod/v4/core';
import { isDeepStrictEqual } from 'node:util';
import { cell, table, referencePage } from './page.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { buildJsonSchema } from '@gspothq/cli/src/policy/json-schema.ts';
import type { Manifest, SettingSpec } from '@gspothq/cli/src/types/kits.ts';
import { exposedSettings } from '@gspothq/cli/src/policy/setting-surface.ts';

const SETTINGS_INTRO = `Every key \`gspot set\` writes and \`gspot list settings\` prints, with its default at each level. A scope inherits the root and the scopes around it: a value replaces the inherited one, and a list adds to it, as [monorepos](/guides/scopes/) shows.

`;

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three cells of the schema table escape HTML and pipes by this one rule.
function schemaCell(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('|', '&#124;')
        .replaceAll('\n', ' ');
}

function schemaRow(node: JSONSchema.JSONSchema | boolean, path: string, required: boolean): string {
    const presence = required ? 'Required' : 'Optional';
    if (typeof node === 'boolean')
        return `| <code>${schemaCell(path)}</code> | ${presence} | ${node ? 'Any value' : 'Not accepted'} | |`;
    const constraints = Object.fromEntries(
        Object.entries(node).filter(
            ([key, value]) =>
                !['properties', 'items', 'anyOf', 'description'].includes(key) &&
                (key !== 'additionalProperties' || typeof value === 'boolean'),
        ),
    );
    return `| <code>${schemaCell(path)}</code> | ${presence} | <code>${schemaCell(JSON.stringify(constraints))}</code> | ${schemaCell(node.description ?? '')} |`;
}

function schemaRows(node: JSONSchema.JSONSchema | boolean, path: string, required: boolean): string[] {
    const row = schemaRow(node, path, required);
    if (typeof node === 'boolean') return [row];
    const properties = Object.entries(node.properties ?? {}).flatMap(([name, child]) =>
        schemaRows(child, `${path}.${name}`, node.required?.includes(name) === true),
    );
    const items = node.items === undefined ? [] : [node.items].flat();
    const alternatives = (node.anyOf ?? []).flatMap((child, index) =>
        schemaRows(child, `${path} (form ${String(index + 1)})`, required),
    );
    return [
        row,
        ...properties,
        ...items.flatMap((child) => schemaRows(child, `${path}[]`, false)),
        ...alternatives,
        ...(typeof node.additionalProperties === 'object'
            ? schemaRows(node.additionalProperties, `${path}.*`, false)
            : []),
    ];
}

/**
 * Render all policy fields from the schema used by the production reader.
 * @returns Markdown reference tables
 */
export function policyReference(): string {
    const schema: JSONSchema.JSONSchema = buildJsonSchema();
    const sections = Object.entries(schema.properties ?? {}).map(
        ([name, node]) =>
            `## ${name}\n\n| Field | Presence | Accepted structure and defaults | Meaning |\n| --- | --- | --- | --- |\n${schemaRows(node, name, schema.required?.includes(name) === true).join('\n')}\n`,
    );
    return `The [machine-readable schema](/schema/gspot.schema.json) defines these fields, where \`[]\` marks an array item and \`*\` a key you choose. The policy reader also checks the selected kits, the settings they expose, and the reasons the policy asks for.\n\n${sections.join('\n')}`;
}

/**
 * The settings page: every exposed setting with its owners and the default each owner gives it.
 * @param manifests every kit manifest
 * @returns the page
 */
export function settingsPage(manifests: Manifest[]): ReferencePage {
    const seen = new Map<string, { setting: SettingSpec; owners: string[] }[]>();
    const definitions = [
        ...[...exposedSettings([]).specs.values()].map((setting) => ({ setting, owner: 'Repository policy' })),
        ...manifests.flatMap((manifest) =>
            manifest.settings.map((setting) => ({
                setting,
                owner: `[${manifest.kit.name}](/reference/kits/${manifest.kit.name}/)`,
            })),
        ),
    ];
    for (const { setting, owner } of definitions) {
        const variants = seen.get(setting.name) ?? [];
        if (variants.length === 0) {
            seen.set(setting.name, [{ setting, owners: [owner] }]);
            continue;
        }
        // Manifest validation makes every declaration of a setting agree, so declarations differ only in their default.
        const variant = variants.find((entry) =>
            isDeepStrictEqual(
                [entry.setting.default, entry.setting.default_all],
                [setting.default, setting.default_all],
            ),
        );
        if (variant === undefined) variants.push({ setting, owners: [owner] });
        else if (!variant.owners.includes(owner)) variant.owners.push(owner);
    }
    const rows = seen
        .values()
        .toArray()
        .flat()
        .toSorted((a, b) => a.setting.name.localeCompare(b.setting.name))
        .map(({ setting, owners }) => {
            const recommended = setting.default;
            const all = setting.default_all ?? recommended;
            return [
                `\`${setting.name}\``,
                setting.type,
                setting.direction,
                `recommended: \`${recommended === undefined ? 'unset' : cell(JSON.stringify(recommended))}\`; all: \`${all === undefined ? 'unset' : cell(JSON.stringify(all))}\``,
                cell(setting.summary),
                owners.join(', '),
            ];
        });
    return referencePage(
        'Settings',
        'Settings exposed by gspot set, with their types, directions, defaults, and owners.',
        `${SETTINGS_INTRO}${table(['Key', 'Type', 'Direction', 'Default', 'Meaning', 'Kit'], rows)}\n`,
    );
}
