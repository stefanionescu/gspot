import type { JSONSchema } from 'zod/v4/core';
import { isDeepStrictEqual } from 'node:util';
import { cell, referencePage, table } from './page.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { policyJsonSchema } from '@gspot/cli/src/policy/json-schema.ts';
import { exposedSettings } from '@gspot/cli/src/policy/setting-surface.ts';
import type { Manifest, SettingSpec } from '@gspot/cli/src/types/configurations.ts';

function schemaCell(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('|', '&#124;')
        .replaceAll('\n', ' ');
}

function schemaRows(node: JSONSchema.JSONSchema | boolean, path: string, required: boolean): string[] {
    if (typeof node === 'boolean')
        return [
            `| <code>${schemaCell(path)}</code> | ${required ? 'Required' : 'Optional'} | ${node ? 'Any value' : 'Not accepted'} | |`,
        ];
    const constraints = Object.fromEntries(
        Object.entries(node).filter(
            ([key, value]) =>
                !['properties', 'items', 'anyOf', 'description'].includes(key) &&
                (key !== 'additionalProperties' || typeof value === 'boolean'),
        ),
    );
    const row = `| <code>${schemaCell(path)}</code> | ${required ? 'Required' : 'Optional'} | <code>${schemaCell(JSON.stringify(constraints))}</code> | ${schemaCell(node.description ?? '')} |`;
    const properties = Object.entries(node.properties ?? {}).flatMap(([name, child]) =>
        schemaRows(child, `${path}.${name}`, node.required?.includes(name) === true),
    );
    const items = node.items === undefined ? [] : Array.isArray(node.items) ? node.items : [node.items];
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

function comparable(setting: SettingSpec): Record<string, unknown> {
    return Object.fromEntries(Object.entries(setting).filter(([key]) => key !== 'default' && key !== 'detect'));
}

/**
 * Render all policy fields from the schema used by the production reader.
 * @returns Markdown reference tables
 */
export function configurationReference(): string {
    const schema: JSONSchema.JSONSchema = policyJsonSchema();
    const sections = Object.entries(schema.properties ?? {}).map(
        ([name, node]) =>
            `## ${name}\n\n| Field | Presence | Accepted structure and defaults | Meaning |\n| --- | --- | --- | --- |\n${schemaRows(node, name, schema.required?.includes(name) === true).join('\n')}\n`,
    );
    return `The [machine-readable configuration schema](/schema/gspot.schema.json) defines these fields. Required means required within the containing table or array item. An optional table does not make its required children mandatory at the repository root.\n\n\`[]\` identifies an array item; \`*\` identifies a user-defined key. Alternative forms describe different accepted values for the same field. Constraints use JSON Schema notation, including \`enum\` for accepted values, \`default\` for schema defaults, and \`additionalProperties: false\` for tables that reject unknown keys.\n\nThe policy reader also validates selected configurations, exposed settings, cross-field relationships, and required reasons. Use version 1 policies. See [scopes](/guides/scopes/) for inheritance and [settings](/reference/settings/) for configuration-owned values.\n\n${sections.join('\n')}`;
}

/**
 * The settings page: every exposed setting with its owners and the default each owner gives it.
 * @param manifests every configuration manifest
 * @returns the page
 */
export function settingsPage(manifests: Manifest[]): ReferencePage {
    const seen = new Map<string, { setting: SettingSpec; owners: string[] }[]>();
    const definitions = [
        ...[...exposedSettings([]).specs.values()].map((setting) => ({ setting, owner: 'Repository policy' })),
        ...manifests.flatMap((manifest) =>
            manifest.settings.map((setting) => ({
                setting,
                owner: `[the ${manifest.configuration.name} configuration](/reference/configurations/${manifest.configuration.name}/)`,
            })),
        ),
    ];
    for (const { setting, owner } of definitions) {
        const variants = seen.get(setting.name) ?? [];
        const previous = variants[0];
        if (previous === undefined) {
            seen.set(setting.name, [{ setting, owners: [owner] }]);
            continue;
        }
        // A later declaration overrides the default; the declaration that owns the setting carries its detection.
        if (!isDeepStrictEqual(comparable(previous.setting), comparable(setting)))
            throw new Error(
                `Conflicting setting definition: ${setting.name} (${previous.owners.join(', ')} and ${owner}).`,
            );
        const variant = variants.find((entry) => isDeepStrictEqual(entry.setting.default, setting.default));
        if (variant === undefined) variants.push({ setting, owners: [owner] });
        else if (!variant.owners.includes(owner)) variant.owners.push(owner);
    }
    const rows = seen
        .values()
        .toArray()
        .flat()
        .toSorted((a, b) => a.setting.name.localeCompare(b.setting.name))
        .map(({ setting, owners }) => [
            `\`${setting.name}\``,
            setting.kind,
            setting.direction,
            setting.default === undefined ? '' : `\`${cell(JSON.stringify(setting.default))}\``,
            cell(setting.summary),
            owners.join(', '),
        ]);
    return referencePage(
        'Settings',
        'Settings exposed by gspot set, with their kinds, directions, defaults, and owners.',
        `Every key \`gspot set\` writes and \`gspot list settings\` prints. Reasons are optional unless the repository enables \`require_reasons\`.

## Scope and precedence

Configuration defaults apply first. Explicit root values follow, then matching ancestor scopes from outermost to innermost. Scalars replace inherited values. Lists append and deduplicate. Language and naming-category settings refine their general setting. The selected configuration determines which tool settings are available in each scope.

Use \`gspot set <key> <value> --scope <path>\` to write an existing scope. Without \`--scope\`, the command writes the root. \`--default\` removes a written override; an inherited value can still apply. Integration settings such as hooks, CI, rules, and runner configuration belong to the repository root. See [configuration fields](/reference/configuration/) for the fields accepted inside a scope.

\`gspot list settings\` shows effective values and their sources. Run it before changing an inherited setting. For list editing, \`--replace\` replaces the list written in that table; inherited entries still follow the setting merge contract.

## Scoped configuration example

This complete policy sets a repository limit and tightens it for the app scope:

\`\`\`toml
version = 1
configurations = ["javascript"]
[limits]
file_lines = 200
[[scope]]
path = "app"
[scope.limits]
file_lines = 100
\`\`\`

Files outside app use 200 lines. Files in app inherit the JavaScript configuration and use 100 lines.

${table(['Key', 'Kind', 'Direction', 'Default', 'Meaning', 'Configuration'], rows)}\n`,
    );
}
