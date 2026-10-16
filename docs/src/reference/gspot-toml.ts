import { isDeepStrictEqual } from 'node:util';
import type { JSONSchema } from 'zod/v4/core';
import { isRecord } from '#cli/system/values.ts';
import { sortedToml } from '#cli/settings/file.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { cell, table, section, referencePage } from './markdown.ts';
import { buildJsonSchema } from '#cli/settings/schema/gspot-toml.ts';
import { version } from '@gspothq/cli/package.json' with { type: 'json' };
import type { ReferencePage, SettingVariant } from '../types/reference.ts';
import { knownSettings, configurationSettings } from '#cli/settings/view.ts';
import { GSPOT_TOML_INTRO, REFERENCE_FOLDERS, SCHEMA_TYPE_LABELS } from '../config/reference.ts';

function acceptedValue(node: JSONSchema.JSONSchema | boolean): string {
    if (typeof node === 'boolean') return node ? 'Any value' : 'Not accepted';
    if (node.const !== undefined)
        return [`\`${JSON.stringify(node.const)}\``, node.description]
            .filter((entry) => entry !== undefined)
            .map((entry) => cell(entry))
            .join(': ');
    if (node.enum !== undefined) return node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined) return [...new Set(node.anyOf.map((entry) => acceptedValue(entry)))].join(' or ');
    const labels: Readonly<Record<string, string>> = SCHEMA_TYPE_LABELS;
    return [node.type ?? 'Value']
        .flat()
        .map((type) => labels[type] ?? type)
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
 * Describe the keys, accepted values, and examples of each schema section.
 * @param schema the generated settings schema
 * @returns the Markdown sections
 */
function schemaSections(schema: JSONSchema.JSONSchema): string {
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
                    : `See the [settings reference](/reference/gspot-toml/) for ${topic}.`,
            ]);
        const example = schema.examples?.filter(isRecord).find((document) => Object.hasOwn(document, name));
        const text = example === undefined ? '' : sortedToml(example);
        return section(
            name,
            (text.trim() === '' ? '' : `\`\`\`toml\n${text}\`\`\`\n\n`) +
                table(['Key', 'Accepted value', 'Meaning'], rows),
        );
    });
    return sections.join('\n');
}

/**
 * Group each setting's defaults with the configurations that declare them.
 * @param manifests the shipped configurations
 * @returns the distinct defaults and their configurations
 */
function settingVariants(manifests: Manifest[]): SettingVariant[] {
    const seen = new Map<string, SettingVariant[]>();
    const definitions = [
        ...[...knownSettings([]).declarations.values()].map((setting) => ({ setting, owner: 'gspot' })),
        ...manifests.flatMap((manifest) =>
            configurationSettings(manifest.configuration.name).map((setting) => ({
                setting,
                owner: `[${manifest.configuration.name}](/reference/${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}/)`,
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
    return seen
        .values()
        .toArray()
        .flat()
        .toSorted((a, b) => a.setting.name.localeCompare(b.setting.name));
}

/**
 * Build the settings and file-format reference from the CLI declarations and schema.
 * @param manifests the shipped configurations
 * @returns the gspot.toml reference page
 */
export function gspotTomlPage(manifests: Manifest[]): ReferencePage {
    const schema: JSONSchema.JSONSchema = buildJsonSchema();
    const fields = schemaSections(schema);
    const rows = settingVariants(manifests).map(({ setting, owners }) => {
        const recommended = setting.default;
        const all = setting.default_all ?? recommended;
        const defaultRecommended = recommended === undefined ? 'unset' : cell(JSON.stringify(recommended));
        const defaultAll = all === undefined ? 'unset' : cell(JSON.stringify(all));
        return [
            `\`${setting.name}\``,
            setting.type,
            setting.reason_needed ?? '',
            isDeepStrictEqual(recommended, all)
                ? `\`${defaultRecommended}\``
                : `recommended: \`${defaultRecommended}\`; all: \`${defaultAll}\``,
            cell(setting.summary),
            owners.join(', '),
        ];
    });
    return referencePage(
        'gspot.toml reference',
        'Every table and key of gspot.toml, with examples.',
        `${GSPOT_TOML_INTRO}[JSON Schema](https://unpkg.com/@gspothq/cli@${version}/gspot.schema.json) for this version.\n\n${fields}\nEvery setting, with its type, its default, the configuration that declares it, and when a change needs a reason.\n\n${table(['Key', 'Type', 'Reason needed when', 'Default', 'Meaning', 'Configuration'], rows)}\n`,
    );
}
