import { isDeepStrictEqual } from 'node:util';
import type { JSONSchema } from 'zod/v4/core';
import { SCHEMA_FILE } from '#cli/config/settings/schema.ts';
import type { ReferencePage, ReferenceFacts } from '../types/reference.ts';
import { formatTable, formatSection, buildReferencePage, formatReferencePath } from './markdown.ts';

import {
    MAP_KEY_NAME,
    ANGLE_BRACKETS,
    REFERENCE_FOLDERS,
    HEADING_ID_DROPPED,
    SCHEMA_TYPE_LABELS,
    LISTED_VALUES_LIMIT,
    TABLE_HEADING_LEVEL,
    CATEGORY_PLACEHOLDER,
    LANGUAGE_PLACEHOLDER,
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
            .join(': ');
    if (node.enum !== undefined)
        return node.enum.length > LISTED_VALUES_LIMIT
            ? `One of ${String(node.enum.length)} names`
            : node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined) {
        const branches = node.anyOf.map((entry) => getSchemaNode(schema, entry));
        // Values that each carry their own meaning read better as a table than as one long sentence.
        if (branches.every((branch) => branch.const !== undefined && branch.description !== undefined)) {
            const rows = branches.map((branch) => [`\`${JSON.stringify(branch.const)}\``, branch.description ?? '']);
            return `One of these values:\n\n${formatTable(['Value', 'Meaning'], rows)}\n\n`;
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

function formatDefaults(variants: ReferenceFacts['settings']): string {
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

// The languages whose default differs from the default of the key.
function formatLanguageDefaults(variants: ReferenceFacts['settings']): string {
    const defaults = variants.flatMap(({ setting }) =>
        setting.language_defaults === undefined ? [] : Object.entries(setting.language_defaults),
    );
    const entries = defaults.map(([language, value]) => language + ' ' + `\`${JSON.stringify(value)}\``);
    return entries.length === 0 ? '' : ` Language defaults: ${entries.join(', ')}.`;
}

function formatSetting(
    facts: ReferenceFacts,
    key: string,
    { node, required }: { node: JSONSchema.JSONSchema; required: boolean },
): string {
    const variants = facts.settings.filter(({ setting }) => setting.name === key);
    const reasons = [
        ...new Set(
            variants.flatMap(({ setting }) => (setting.reason_needed === undefined ? [] : [setting.reason_needed])),
        ),
    ];
    const accepted = formatAcceptedValue(facts.schema, node);
    const sentence = accepted.charAt(0).toUpperCase() + accepted.slice(1) + (/[.\n]$/u.test(accepted) ? '' : '.');
    // A record field without a declared default takes the default of its schema.
    const schemaDefault = node.default === undefined ? 'unset' : `\`${JSON.stringify(node.default)}\``;
    const presence = required ? 'Required.' : `Default: ${formatDefaults(variants) || schemaDefault}.`;
    return (
        `${sentence} ${presence}` +
        (reasons.length === 0 ? '' : ` Reason needed when: ${reasons.join(', ')}.`) +
        formatLanguageDefaults(variants) +
        (node.description === undefined ? '' : `\n\n${node.description}`)
    );
}

// A key holds a value; a table or a record holds keys.
function isSettingValue(schema: JSONSchema.JSONSchema, node: JSONSchema.JSONSchema): boolean {
    return isReasonedValue(node) || listSchemaProperties(schema, node).length === 0;
}

// Each key of a table or a record under its own heading, one level below the table, with the full key as its anchor.
function formatSettingKeys(
    facts: ReferenceFacts,
    prefix: string,
    keys: ReturnType<typeof listSchemaProperties>,
    level: number,
): string {
    return keys
        .map(({ name, node, required }) => {
            const key = prefix === '' ? name : `${prefix}.${name}`;
            const heading = `<h${String(level)} id="${key.replaceAll(ANGLE_BRACKETS, '')}"><code>${key}</code></h${String(level)}>`;
            return `${heading}\n\n${formatSetting(facts, key, { node, required })}\n`;
        })
        .join('\n');
}

// A table whose keys all repeat keys of the table around it sets those keys for one language or one category.
function listVariantTables(
    schema: JSONSchema.JSONSchema,
    node: JSONSchema.JSONSchema,
): ReturnType<typeof listSchemaProperties> {
    const children = listSchemaProperties(schema, node);
    const names = new Set(children.filter((child) => isSettingValue(schema, child.node)).map(({ name }) => name));
    return children.filter((child) => {
        const keys = listSchemaProperties(schema, child.node).filter((entry) => isSettingValue(schema, entry.node));
        return !isSettingValue(schema, child.node) && keys.length > 0 && keys.every(({ name }) => names.has(name));
    });
}

// One section for all the language tables of a table, and the categories of names each language takes.
function formatVariantSection(schema: JSONSchema.JSONSchema, key: string, node: JSONSchema.JSONSchema, level: number) {
    const languages = listVariantTables(schema, node);
    if (languages.length === 0) return '';
    const pattern = `${key}.${LANGUAGE_PLACEHOLDER}`;
    const categories = languages.map(({ name, node: table }) => [name, listVariantTables(schema, table)] as const);
    const named = categories.filter(([, tables]) => tables.length > 0);
    const languageNames = languages.map(({ name }) => `\`${name}\``).join(', ');
    return (
        `\n${'#'.repeat(level)} \`${pattern}\`\n\n` +
        `The keys of \`[${key}]\` for one language: ${languageNames}. ` +
        `A key you leave out takes the value of \`[${key}]\`.\n` +
        (named.length === 0
            ? ''
            : `\n\`${pattern}.${CATEGORY_PLACEHOLDER}\` sets the same keys for one category of names, and a key you ` +
              `leave out takes the value of \`${pattern}\`. The categories of each language:\n\n` +
              formatTable(
                  ['Language', 'Categories'],
                  named.map(([name, tables]) => [`\`${name}\``, tables.map((table) => `\`${table.name}\``).join(', ')]),
              ) +
              '\n')
    );
}

// A table or a record: its description and its keys, then the tables and records inside it, one heading level down.
function formatSettingTable(
    facts: ReferenceFacts,
    key: string,
    value: JSONSchema.JSONSchema | boolean,
    level: number,
): string {
    const { schema } = facts;
    const node = getSchemaNode(schema, value);
    const children = listSchemaProperties(schema, node);
    const keys = children.filter((child) => isSettingValue(schema, child.node));
    const variants = new Set(listVariantTables(schema, node).map(({ name }) => name));
    const header = node.type === 'array' ? `[[${key}]]` : `[${key}]`;
    return (
        `\n${'#'.repeat(level)} ${header}\n\n` +
        (node.description === undefined ? '' : `${node.description}\n\n`) +
        (key === 'naming'
            ? 'See [Accept a banned name](/configure/gspot-toml/#accept-a-banned-name) for an exact-name override.\n\n'
            : '') +
        (keys.length === 0 ? '' : `${formatSettingKeys(facts, key, keys, level + 1)}\n`) +
        children
            .filter((child) => !isSettingValue(schema, child.node) && !variants.has(child.name))
            .map((child) => formatSettingTable(facts, `${key}.${child.name}`, child.node, level + 1))
            .join('') +
        formatVariantSection(schema, key, node, level + 1)
    );
}

// A scope takes its own keys and every root table, apart from the keys that only the root takes.
function formatScopeSection(facts: ReferenceFacts, value: JSONSchema.JSONSchema | boolean): string {
    const { schema } = facts;
    const node = getSchemaNode(schema, value);
    const children = listSchemaProperties(schema, node);
    const accepted = new Set(children.map(({ name }) => name));
    const rootOnly = listSchemaProperties(schema, schema)
        .map(({ name }) => name)
        .filter((name) => name !== 'scope' && !accepted.has(name));
    const rootOnlyNames = rootOnly.map((name) => `\`${name}\``).join(', ');
    return (
        `\n## ${node.type === 'array' ? '[[scope]]' : '[scope]'}\n\n` +
        (node.description === undefined ? '' : `${node.description}\n\n`) +
        'See [Monorepos and scopes](/configure/monorepos/) for how a scope inherits settings.\n\n' +
        formatSettingKeys(
            facts,
            'scope',
            children.filter((child) => isSettingValue(schema, child.node)),
            TABLE_HEADING_LEVEL + 1,
        ) +
        `\n\nOnly the root takes these keys: ${rootOnlyNames}.\n`
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

/**
 * Link a setting to its row, or a table or record to its heading, on the gspot.toml pages.
 *
 * @param schema the JSON Schema of gspot.toml
 * @param key the dotted key, such as format.indent_style or import_rule
 * @returns the Markdown link
 */
export function linkSetting(schema: JSONSchema.JSONSchema, key: string): string {
    const { path, node } = findSettingPath(schema, key);
    const name = path.join('.');
    // A key anchors its row; a table or a record anchors its heading, by the ID that Starlight gives the heading.
    const header = node.type === 'array' ? `[[${name}]]` : `[${name}]`;
    const anchor = isSettingValue(schema, node)
        ? name.replaceAll(ANGLE_BRACKETS, '')
        : header.toLowerCase().replaceAll(HEADING_ID_DROPPED, '');
    return `[\`${key}\`](${formatReferencePath('settings', '')}#${anchor})`;
}

/**
 * Build the one settings page: the top-level keys, then every table and record, each key under its own heading.
 *
 * @param facts settings variants and JSON Schema from the CLI
 * @returns the page, keyed by its path
 */
export function buildSettingsPages(facts: ReferenceFacts): Map<string, ReferencePage> {
    const { schema } = facts;
    const roots = listSchemaProperties(schema, schema);
    const sections = roots
        .filter((child) => !isSettingValue(schema, child.node))
        .map(({ name, node }) =>
            name === 'scope'
                ? formatScopeSection(facts, node)
                : formatSettingTable(facts, name, node, TABLE_HEADING_LEVEL),
        );
    const page = buildReferencePage(
        'Settings',
        'Every key, accepted value, and default of gspot.toml.',
        'Every key of `gspot.toml`, its accepted values, and its default. See [gspot.toml](/configure/gspot-toml/) to change them.\n\n' +
            `The [JSON Schema](/${SCHEMA_FILE}) describes every key. Editors apply it on their own once SchemaStore lists gspot.\n` +
            formatSection(
                'Top-level keys',
                formatSettingKeys(
                    facts,
                    '',
                    roots.filter((child) => isSettingValue(schema, child.node)),
                    TABLE_HEADING_LEVEL + 1,
                ),
            ) +
            sections.join(''),
    );
    // Every key has a heading, so the table of contents lists the tables only.
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return new Map([[`${REFERENCE_FOLDERS.settings}/index.md`, page]]);
}
