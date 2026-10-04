import type { JSONSchema } from 'zod/v4/core';
import { buildJsonSchema } from './schema.ts';
import { isDeepStrictEqual } from 'node:util';
import { cell, table, section, referencePage } from './page.ts';
import type { Manifest } from '@gspothq/cli/src/types/configurations.ts';
import { knownSettings } from '@gspothq/cli/src/policy/settings/known.ts';
import type { ReferencePage, SettingVariant } from '../../types/reference.ts';
import { SETTINGS_INTRO, POLICY_EXAMPLES, SCHEMA_TYPE_LABELS } from '../../config/reference.ts';

function acceptedValue(node: JSONSchema.JSONSchema | boolean): string {
    if (typeof node === 'boolean') return node ? 'Any value' : 'Not accepted';
    if (node.enum !== undefined) return node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined) return [...new Set(node.anyOf.map((entry) => acceptedValue(entry)))].join(' or ');
    if (Array.isArray(node.type)) return node.type.join(' or ');
    const type = node.type ?? 'Value';
    return SCHEMA_TYPE_LABELS[type] ?? type;
}

function schemaProperties(node: JSONSchema.JSONSchema | boolean): Record<string, JSONSchema.JSONSchema | boolean> {
    let shape = node;
    if (typeof node !== 'boolean' && node.type === 'array' && !Array.isArray(node.items) && node.items !== undefined)
        shape = node.items;
    if (typeof shape === 'boolean') return {};
    return shape.properties ?? {};
}

/**
 * Render one readable section per policy table from its validated JSON schema.
 * @returns Markdown examples and key tables
 */
export function policyReference(): string {
    const schema: JSONSchema.JSONSchema = buildJsonSchema();
    const sections = Object.entries(schema.properties ?? {}).map(([name, node]) => {
        const properties = schemaProperties(node);
        const entries = Object.keys(properties).length === 0 ? [[name, node] as const] : Object.entries(properties);
        const topic = name === 'tools' ? 'tool options' : 'settings and defaults';
        const rows = entries.map(([key, value]) => [
            `\`${key}\``,
            acceptedValue(value),
            typeof value !== 'boolean' && value.description !== undefined
                ? cell(value.description)
                : `See the [settings reference](/reference/settings/) for ${topic}.`,
        ]);
        const example = POLICY_EXAMPLES[name];
        return section(
            name,
            (example === undefined ? '' : `\`\`\`toml\n${example}\n\`\`\`\n\n`) +
                table(['Key', 'Accepted value', 'Meaning'], rows),
        );
    });
    return `Customize settings in \`gspot.toml\`, then run \`gspot apply\`. The [machine-readable JSON Schema](/schema/gspot.schema.json) defines full validation for editors. Tool and configuration-specific options are described in the [settings reference](/reference/settings/). Any limit can be set for one language as \`limits.<language>.<name>\`.\n\n${sections.join('\n')}`;
}

/**
 * The settings page: every exposed setting with its owners and the default each owner gives it.
 * @param manifests every configuration manifest
 * @returns the page
 */
export function settingsPage(manifests: Manifest[]): ReferencePage {
    const seen = new Map<string, SettingVariant[]>();
    const definitions = [
        ...[...knownSettings([]).specs.values()].map((setting) => ({ setting, owner: 'Repository policy' })),
        ...manifests.flatMap((manifest) =>
            manifest.settings.map((setting) => ({
                setting,
                owner: `[${manifest.configuration.name}](/reference/configurations/${manifest.configuration.name}/)`,
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
            const defaultRecommended = recommended === undefined ? 'unset' : cell(JSON.stringify(recommended));
            const defaultAll = all === undefined ? 'unset' : cell(JSON.stringify(all));
            return [
                `\`${setting.name}\``,
                setting.type,
                setting.direction,
                isDeepStrictEqual(recommended, all)
                    ? `\`${defaultRecommended}\``
                    : `recommended: \`${defaultRecommended}\`; all: \`${defaultAll}\``,
                cell(setting.summary),
                owners.join(', '),
            ];
        });
    return referencePage(
        'Settings',
        'Settings exposed by gspot set, with their types, directions, defaults, and owners.',
        `${SETTINGS_INTRO}${table(['Key', 'Type', 'Direction', 'Default', 'Meaning', 'Configuration'], rows)}\n`,
        'docs/src/content/reference/policy.ts',
    );
}
