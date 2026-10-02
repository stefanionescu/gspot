import type { JSONSchema } from 'zod/v4/core';
import { isDeepStrictEqual } from 'node:util';
import { cell, table, referencePage } from './page.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { buildJsonSchema } from '@gspothq/cli/src/policy/json-schema.ts';
import type { Manifest, SettingSpec } from '@gspothq/cli/src/types/kits.ts';
import { exposedSettings } from '@gspothq/cli/src/policy/setting-surface.ts';

const SETTINGS_INTRO = `Every key \`gspot set\` writes and \`gspot list settings\` prints. Reasons are optional unless the repository enables \`require_reasons\`.

## Scope and precedence

Configuration defaults apply first. At all, a level-specific default replaces the recommended default when provided. Explicit root values follow, then matching ancestor scopes from outermost to innermost. Scalars replace inherited values. Lists append and deduplicate. Language and naming-category settings refine their general setting. The selected kit determines which tool settings are available in each scope.

Use \`gspot set <key> <value> --scope <path>\` to write an existing scope. Without \`--scope\`, the command writes the root. \`--default\` removes a written override; an inherited value can still apply. Integration settings such as hooks, CI, rules, and runner configuration belong to the repository root. See [configuration fields](/reference/configuration/) for the fields accepted inside a scope.

\`gspot list settings\` shows effective values and their sources. Run it before changing an inherited setting. For list editing, \`--replace\` replaces the list written in that table; inherited entries still follow the setting merge contract.

## Scoped configuration example

This complete policy sets a repository limit and tightens it for the app scope:

\`\`\`toml
kits = ["javascript"]
[limits]
file_lines = 200
[[scope]]
path = "app"
[scope.limits]
file_lines = 100
\`\`\`

Files outside app use 200 lines. Files in app inherit the JavaScript configuration and use 100 lines.

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
export function kitReference(): string {
    const schema: JSONSchema.JSONSchema = buildJsonSchema();
    const sections = Object.entries(schema.properties ?? {}).map(
        ([name, node]) =>
            `## ${name}\n\n| Field | Presence | Accepted structure and defaults | Meaning |\n| --- | --- | --- | --- |\n${schemaRows(node, name, schema.required?.includes(name) === true).join('\n')}\n`,
    );
    return `The [machine-readable configuration schema](/schema/gspot.schema.json) defines these fields. Required means required within the containing table or array item. An optional table does not make its required children mandatory at the repository root.\n\n\`[]\` identifies an array item; \`*\` identifies a user-defined key. Alternative forms describe different accepted values for the same field. Constraints use JSON Schema notation, including \`enum\` for accepted values, \`default\` for schema defaults, and \`additionalProperties: false\` for tables that reject unknown keys.\n\nThe policy reader also validates selected kits, exposed settings, cross-field relationships, and required reasons. Use version 1 policies. See [scopes](/guides/scopes/) for inheritance and [settings](/reference/settings/) for configuration-owned values.\n\n${sections.join('\n')}`;
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
                owner: `[the ${manifest.kit.name} configuration](/reference/kits/${manifest.kit.name}/)`,
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
        `${SETTINGS_INTRO}${table(['Key', 'Type', 'Direction', 'Default', 'Meaning', 'Configuration'], rows)}\n`,
    );
}
