import { isDeepStrictEqual } from 'node:util';
import type { JSONSchema } from 'zod/v4/core';
import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { formatLimitsGuide, formatNamingGuide } from './setting-guides.ts';
import { escapeCell, formatSection, formatDefinitions, buildReferencePage } from './markdown.ts';

import {
    MAP_KEY_NAME,
    ANGLE_BRACKETS,
    PAGE_TITLE_LEVEL,
    LANGUAGE_SETTING,
    SETTINGS_SUBPAGES,
    HEADING_ID_DROPPED,
    SCHEMA_TYPE_LABELS,
    LISTED_VALUES_LIMIT,
    REASONED_VALUE_LABEL,
} from '../config/reference.ts';

function getSchemaNode(schema: JSONSchema.JSONSchema, value: JSONSchema.JSONSchema | boolean): JSONSchema.JSONSchema {
    if (typeof value === 'boolean') return value ? {} : { not: {} };
    let node = value;
    while (node.$ref !== undefined) {
        const { $ref: reference, ...local } = node;
        // buildJsonSchema writes every local reference into $defs.
        const schemas = schema.$defs as Record<string, JSONSchema.JSONSchema>;
        const definition = schemas[reference.slice('#/$defs/'.length)] as JSONSchema.JSONSchema;
        node = { ...definition, ...local };
    }
    return node;
}

// A reasoned value holds exactly a value and the reason for it.
function isReasonedValue(node: JSONSchema.JSONSchema): boolean {
    return (
        node.type === 'object' &&
        node.properties !== undefined &&
        isDeepStrictEqual(
            Object.keys(node.properties).toSorted((first, second) => first.localeCompare(second)),
            ['reason', 'value'],
        )
    );
}

function formatAcceptedValue(schema: JSONSchema.JSONSchema, value: JSONSchema.JSONSchema | boolean): string {
    const node = getSchemaNode(schema, value);
    if (isReasonedValue(node)) return REASONED_VALUE_LABEL;
    if (node.const !== undefined)
        return [`\`${JSON.stringify(node.const)}\``, node.description]
            .filter((entry) => entry !== undefined)
            .map((entry) => escapeCell(entry))
            .join(': ');
    if (node.enum !== undefined)
        return node.enum.length > LISTED_VALUES_LIMIT
            ? `One of ${String(node.enum.length)} names`
            : node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined) {
        const branches = node.anyOf.map((entry) => getSchemaNode(schema, entry));
        // Values that each carry their own meaning read better as a list than as one long sentence.
        if (branches.every((branch) => branch.const !== undefined && branch.description !== undefined)) {
            const items = branches.map((branch) => '- ' + formatAcceptedValue(schema, branch));
            return `One of these values:\n\n${items.join('\n')}\n\n`;
        }
        return [...new Set(node.anyOf.map((entry) => formatAcceptedValue(schema, entry)))].join(' or ');
    }
    const labels: Readonly<Record<string, string>> = SCHEMA_TYPE_LABELS;
    return [node.type ?? 'Value']
        .flat()
        .map((type) => labels[type] ?? type)
        .join(' or ');
}

// The keys under a table or a record: its fixed keys, then the keys of each map entry under a <name> placeholder.
function listSchemaProperties(
    schema: JSONSchema.JSONSchema,
    value: JSONSchema.JSONSchema | boolean,
): Array<{ name: string; node: JSONSchema.JSONSchema; required: boolean }> {
    const node = getSchemaNode(schema, value);
    const shape =
        typeof node.items === 'object' && !Array.isArray(node.items) ? getSchemaNode(schema, node.items) : node;
    const required = new Set(shape.required);
    const fixed =
        shape.properties === undefined
            ? []
            : Object.entries(shape.properties).map(([name, child]) => ({
                  name,
                  node: getSchemaNode(schema, child),
                  required: required.has(name),
              }));
    const map =
        typeof shape.additionalProperties === 'object' ? getSchemaNode(schema, shape.additionalProperties) : undefined;
    return map?.properties === undefined ? fixed : [...fixed, { name: MAP_KEY_NAME, node: map, required: false }];
}

// The declared variants of a setting; a language key without its own declaration takes the language default.
function listSettingVariants(
    name: string,
    data: ReturnType<typeof readReferenceData>,
): ReturnType<typeof readReferenceData>['settings'] {
    const language = LANGUAGE_SETTING.exec(name)?.groups?.['language'];
    const declared = data.settings.filter(({ setting }) => setting.name === name);
    if (declared.length > 0 || language === undefined) return declared;
    return data.settings
        .filter(({ setting }) => setting.name === name.replace(LANGUAGE_SETTING, '$1.$3'))
        .map(({ setting, owners }) => ({
            setting: { ...setting, default: setting.language_defaults?.[language] ?? setting.default },
            owners,
        }));
}

function formatDefaults(variants: ReturnType<typeof readReferenceData>['settings']): string {
    return variants
        .map(({ setting, owners }) => {
            const recommended = setting.default;
            const all = setting.default_all ?? recommended;
            const shown = recommended === undefined ? 'unset' : `\`${JSON.stringify(recommended)}\``;
            const display = isDeepStrictEqual(recommended, all)
                ? shown
                : `recommended: ${shown}; all: \`${JSON.stringify(all)}\``;
            return display + (variants.length > 1 ? ' (' + owners.join(', ') + ')' : '');
        })
        .join('; ');
}

function formatSetting(
    schema: JSONSchema.JSONSchema,
    key: string,
    value: JSONSchema.JSONSchema | boolean,
    data: ReturnType<typeof readReferenceData>,
    required: boolean,
): string {
    const variants = listSettingVariants(key, data);
    const node = getSchemaNode(schema, value);
    const reasons = [
        ...new Set(
            variants.flatMap(({ setting }) => (setting.reason_needed === undefined ? [] : [setting.reason_needed])),
        ),
    ];
    const accepted = formatAcceptedValue(schema, value);
    const sentence = accepted.charAt(0).toUpperCase() + accepted.slice(1) + (/[.\n]$/u.test(accepted) ? '' : '.');
    // A record field without a declared default takes the default of its schema.
    const schemaDefault = node.default === undefined ? 'unset' : `\`${JSON.stringify(node.default)}\``;
    const presence = required ? 'Required.' : `Default: ${formatDefaults(variants) || schemaDefault}.`;
    return (
        `${sentence} ${presence}` +
        (reasons.length === 0 ? '' : ` Reason needed when: ${reasons.join(', ')}.`) +
        (node.description === undefined ? '' : ` ${escapeCell(node.description)}`)
    );
}

// A key holds a value; a table or a record holds keys.
function isSettingValue(schema: JSONSchema.JSONSchema, node: JSONSchema.JSONSchema): boolean {
    return isReasonedValue(node) || listSchemaProperties(schema, node).length === 0;
}

// The header of a table or a record, as the reader writes it in gspot.toml.
function formatTableHeader(key: string, node: JSONSchema.JSONSchema): string {
    return node.type === 'array' ? `[[${key}]]` : `[${key}]`;
}

// The anchor of a key row: the full key without the angle brackets of a map placeholder, because HTML reads them as a tag.
function formatRowId(key: string): string {
    return key.replaceAll(ANGLE_BRACKETS, '');
}

// Each key of a table or a record as one row, named without the table prefix, with the full key as its anchor.
function formatSettingRows(
    data: ReturnType<typeof readReferenceData>,
    prefix: string,
    keys: ReturnType<typeof listSchemaProperties>,
): string {
    return formatDefinitions(
        keys.map(({ name, node, required }) => {
            const key = prefix === '' ? name : `${prefix}.${name}`;
            return [`\`${name}\``, formatSetting(data.schema, key, node, data, required), formatRowId(key)];
        }),
    );
}

// A table or a record: its description and keys, then the tables and records inside it, one heading level down.
// The page title takes the first level, so a table with its own page starts without a heading.
function formatSettingTable(
    data: ReturnType<typeof readReferenceData>,
    key: string,
    value: JSONSchema.JSONSchema | boolean,
    level: number,
): string {
    const { schema } = data;
    const node = getSchemaNode(schema, value);
    const children = listSchemaProperties(schema, node);
    const keys = children.filter((child) => isSettingValue(schema, child.node));
    return (
        (level === PAGE_TITLE_LEVEL ? '' : `\n${'#'.repeat(level)} ${formatTableHeader(key, node)}\n\n`) +
        (node.description === undefined ? '' : `${node.description}\n\n`) +
        (keys.length === 0 ? '' : `${formatSettingRows(data, key, keys)}\n`) +
        children
            .filter((child) => !isSettingValue(schema, child.node))
            .map((child) => formatSettingTable(data, `${key}.${child.name}`, child.node, level + 1))
            .join('')
    );
}

// A scope takes its own keys and every root table, apart from the keys that only the root takes.
function formatScopeSection(
    data: ReturnType<typeof readReferenceData>,
    value: JSONSchema.JSONSchema | boolean,
): string {
    const { schema } = data;
    const node = getSchemaNode(schema, value);
    const children = listSchemaProperties(schema, node);
    const accepted = new Set(children.map(({ name }) => name));
    const rootOnly = listSchemaProperties(schema, schema)
        .map(({ name }) => name)
        .filter((name) => name !== 'scope' && !accepted.has(name));
    return (
        `\n## ${formatTableHeader('scope', node)}\n\n` +
        (node.description === undefined ? '' : `${node.description}\n\n`) +
        'See [Monorepos and scopes](/configure/monorepos/) for how a scope inherits settings.\n\n' +
        formatSettingRows(
            data,
            'scope',
            children.filter((child) => isSettingValue(schema, child.node)),
        ) +
        `\n\nOnly the root takes these keys: ${rootOnly.map((name) => '`' + name + '`').join(', ')}.\n`
    );
}

// The schema names of a dotted key; a map key, such as a language, reads as the map placeholder.
function findSettingPath(schema: JSONSchema.JSONSchema, key: string): { path: string[]; node: JSONSchema.JSONSchema } {
    let node = schema;
    const path: string[] = [];
    for (const segment of key.split('.')) {
        const children = listSchemaProperties(schema, node);
        const child =
            children.find(({ name }) => name === segment) ?? children.find(({ name }) => name === MAP_KEY_NAME);
        if (child === undefined) throw new Error(`The gspot.toml schema has no setting ${key}.`);
        path.push(child.name);
        node = child.node;
    }
    return { path, node };
}

// A key anchors its row; a table or a record anchors its heading, by the ID that Starlight gives the heading.
function formatSettingAnchor(schema: JSONSchema.JSONSchema, path: string[], node: JSONSchema.JSONSchema): string {
    const key = path.join('.');
    return isSettingValue(schema, node)
        ? formatRowId(key)
        : formatTableHeader(key, node).toLowerCase().replaceAll(HEADING_ID_DROPPED, '');
}

/**
 * Link a setting to its row, or a table or record to its heading, on the gspot.toml pages.
 * @param schema the JSON Schema of gspot.toml
 * @param key the dotted key, such as format.indent_style or import_rule
 * @returns the Markdown link
 */
export function linkSetting(schema: JSONSchema.JSONSchema, key: string): string {
    const { path, node } = findSettingPath(schema, key);
    const [table = ''] = path;
    if (!SETTINGS_SUBPAGES.has(table))
        return `[\`${key}\`](/reference/gspot-toml/#${formatSettingAnchor(schema, path, node)})`;
    // A table with its own page starts that page, without a heading.
    if (path.length === 1) return `[\`${key}\`](/reference/gspot-toml/${table}/)`;
    return `[\`${key}\`](/reference/gspot-toml/${table}/#${formatSettingAnchor(schema, path, node)})`;
}

/**
 * Build one settings index and a page for each large table.
 * @param data settings variants and JSON Schema from the CLI
 * @returns reference pages by path
 */
export function buildSettingsPages(data: ReturnType<typeof readReferenceData>): Map<string, ReferencePage> {
    const { schema } = data;
    const pages = new Map<string, ReferencePage>();
    const roots = listSchemaProperties(schema, schema);
    const subpages: string[] = [];
    const sections: string[] = [];
    for (const { name, node } of roots.filter((child) => !isSettingValue(schema, child.node))) {
        if (name === 'scope') {
            sections.push(formatScopeSection(data, node));
            continue;
        }
        const header = SETTINGS_SUBPAGES.get(name);
        if (header === undefined) {
            sections.push(formatSettingTable(data, name, node, PAGE_TITLE_LEVEL + 1));
            continue;
        }
        const guides: Record<string, () => string> = {
            limits: () => formatLimitsGuide(data),
            naming: () => formatNamingGuide(data),
        };
        const body = (guides[name]?.() ?? '') + formatSettingTable(data, name, node, PAGE_TITLE_LEVEL);
        pages.set(`gspot-toml/${name}.md`, buildReferencePage(header.title, header.description, body));
        subpages.push(`- [${header.title}](/reference/gspot-toml/${name}/): ${header.description}`);
    }
    pages.set(
        'gspot-toml/index.md',
        buildReferencePage(
            'Settings',
            'Every key, accepted value, and default of gspot.toml.',
            'Every key of `gspot.toml`, its accepted values, and its default. See [gspot.toml](/configure/gspot-toml/) to change them.\n\n' +
                `The [JSON Schema](/${data.schemaFile}) describes every key. Editors apply it on their own once SchemaStore lists gspot.\n\n` +
                `These tables have their own page:\n\n${subpages.join('\n')}\n` +
                formatSection(
                    'Top-level keys',
                    formatSettingRows(
                        data,
                        '',
                        roots.filter((child) => isSettingValue(schema, child.node)),
                    ),
                ) +
                sections.join(''),
        ),
    );
    return pages;
}
