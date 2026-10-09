import { buildJsonSchema } from './schema.ts';
import { isDeepStrictEqual } from 'node:util';
import type { JSONSchema } from 'zod/v4/core';
import { cell, table, section, referencePage } from './page.ts';
import { isRecord } from '@gspothq/cli/src/platform/contracts.ts';
import { emitPolicy } from '@gspothq/cli/src/policy/document/public.ts';
import type { Manifest } from '@gspothq/cli/src/types/configurations.ts';
import { knownSettings } from '@gspothq/cli/src/policy/settings/public.ts';
import type { ReferencePage, SettingVariant } from '../../types/reference.ts';
import { SETTINGS_INTRO, SCHEMA_TYPE_LABELS } from '../../config/reference.ts';

function acceptedValue(node: JSONSchema.JSONSchema | boolean): string {
    if (typeof node === 'boolean') return node ? 'Any value' : 'Not accepted';
    if (node.const !== undefined)
        return [`\`${JSON.stringify(node.const)}\``, node.description]
            .filter((entry) => entry !== undefined)
            .map((entry) => cell(entry))
            .join(': ');
    if (node.enum !== undefined) return node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined) return [...new Set(node.anyOf.map((entry) => acceptedValue(entry)))].join(' or ');
    return [node.type ?? 'Value']
        .flat()
        .map((type) => SCHEMA_TYPE_LABELS[type] ?? type)
        .join(' or ');
}

function schemaProperties(node: JSONSchema.JSONSchema | boolean): Array<[string, JSONSchema.JSONSchema | boolean]> {
    if (typeof node === 'boolean') return [];
    const child = node.items ?? node.additionalProperties;
    const shape = typeof child === 'object' && !Array.isArray(child) ? child : node;
    if (shape.properties === undefined) return [];
    return Object.entries(shape.properties);
}

/**
 * Render one readable section per policy table from its validated JSON schema.
 * @returns Markdown examples and key tables
 */
export function policyReference(): string {
    const schema: JSONSchema.JSONSchema = buildJsonSchema();
    const sections = schemaProperties(schema).map(([name, node]) => {
        const properties = schemaProperties(node);
        const entries = properties.length === 0 ? [[name, node] as const] : properties;
        const topic = name === 'tools' ? 'tool options' : 'settings and defaults';
        const rows = entries
            .flatMap(([key, value]) => [
                [key, value] as const,
                ...schemaProperties(value).map(([child, schema]) => [`${key}.${child}`, schema] as const),
            ])
            .map(([key, value]) => [
                `\`${key}\``,
                acceptedValue(value),
                typeof value !== 'boolean' && value.description !== undefined
                    ? cell(value.description)
                    : `See the [settings reference](/reference/settings/) for ${topic}.`,
            ]);
        const example = schema.examples?.filter(isRecord).find((document) => Object.hasOwn(document, name));
        const text = example === undefined ? '' : emitPolicy('', example);
        return section(
            name,
            (text.trim() === '' ? '' : `\`\`\`toml\n${text}\`\`\`\n\n`) +
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
        ...[...knownSettings([]).declarations.values()].map((setting) => ({ setting, owner: 'Repository policy' })),
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
                setting.direction ?? '',
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
        `${SETTINGS_INTRO}${table(['Key', 'Type', 'Loosens when', 'Default', 'Meaning', 'Configuration'], rows)}\n`,
        'docs/src/content/reference/policy.ts',
    );
}
