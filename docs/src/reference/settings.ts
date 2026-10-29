import { isDeepStrictEqual } from 'node:util';
import { CLI_REFERENCE } from '#docs/reference/cli.ts';
import { SCHEMA_FILE } from '#cli/config/files/names.ts';
import type { CliReference, ReferencePage, SettingsSchema } from '#docs/types/reference.ts';
import { formatTable, formatSection, buildReferencePage } from '#docs/reference/markdown.ts';

import {
    DEFS_PREFIX,
    SENTENCE_END,
    REFERENCE_PATH,
    ANGLE_BRACKETS,
    SETTINGS_OPENING,
    NAME_PLACEHOLDER,
    REFERENCE_FOLDERS,
    TOP_LEVEL_HEADING,
    SCHEMA_TYPE_LABELS,
    BANNED_NAME_MESSAGE,
    HEADING_ID_STRIPPED,
    LISTED_VALUES_LIMIT,
    TABLE_HEADING_LEVEL,
    SETTINGS_DESCRIPTION,
    CATEGORY_PLACEHOLDER,
    LANGUAGE_PLACEHOLDER,
    REASONED_VALUE_LABEL,
    MONOREPOS_SCOPE_MESSAGE,
} from '#docs/config/reference.ts';

function getSchemaNode(schema: SettingsSchema, subschema: SettingsSchema | boolean): SettingsSchema {
    if (typeof subschema === 'boolean') return subschema ? {} : { not: {} };
    let node = subschema;
    while (node.$ref !== undefined) {
        const { $ref: reference, ...local } = node;
        const schemas = schema.$defs as Record<string, SettingsSchema>;
        const definition = schemas[reference.slice(DEFS_PREFIX.length)] as SettingsSchema;
        node = { ...definition, ...local };
    }
    return node;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, formatAcceptedValue passes the complexity limit.
function isReasonedSchema(node: SettingsSchema): boolean {
    return (
        node.type === 'object' &&
        node.properties !== undefined &&
        isDeepStrictEqual(
            Object.keys(node.properties).toSorted((first, second) => first.localeCompare(second)),
            ['reason', 'value'],
        )
    );
}

function formatAcceptedValue(schema: SettingsSchema, subschema: SettingsSchema | boolean): string {
    const node = getSchemaNode(schema, subschema);
    if (isReasonedSchema(node)) return REASONED_VALUE_LABEL;
    if (node.const !== undefined)
        return [`\`${JSON.stringify(node.const)}\``, node.description].filter((text) => text !== undefined).join(': ');
    if (node.enum !== undefined)
        return node.enum.length > LISTED_VALUES_LIMIT
            ? `One of ${String(node.enum.length)} names`
            : node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined) {
        const branches = node.anyOf.map((option) => getSchemaNode(schema, option));
        if (branches.every((branch) => branch.const !== undefined && branch.description !== undefined)) {
            const rows = branches.map((branch) => [`\`${JSON.stringify(branch.const)}\``, branch.description ?? '']);
            return `One of these values:\n\n${formatTable(['Value', 'Meaning'], rows)}\n\n`;
        }
        return [...new Set(node.anyOf.map((option) => formatAcceptedValue(schema, option)))].join(' or ');
    }
    return [node.type ?? 'Value']
        .flat()
        .map((type) => SCHEMA_TYPE_LABELS[type] ?? type)
        .join(' or ');
}

function listSchemaProperties(
    schema: SettingsSchema,
    subschema: SettingsSchema | boolean,
): Array<{ name: string; node: SettingsSchema; required: boolean }> {
    const node = getSchemaNode(schema, subschema);
    const shape =
        typeof node.items === 'object' && !Array.isArray(node.items) ? getSchemaNode(schema, node.items) : node;
    const required = new Set(shape.required);
    const fixed =
        shape.properties === undefined
            ? []
            : Object.entries(shape.properties)
                  .map(([name, child]) => ({
                      name,
                      node: getSchemaNode(schema, child),
                      required: required.has(name),
                  }))
                  .filter(
                      ({ node }) =>
                          node.not === undefined || typeof node.not !== 'object' || Object.keys(node.not).length > 0,
                  );
    const recordShape =
        typeof shape.additionalProperties === 'object' ? getSchemaNode(schema, shape.additionalProperties) : undefined;
    return recordShape?.properties === undefined
        ? fixed
        : [...fixed, { name: NAME_PLACEHOLDER, node: recordShape, required: false }];
}

function formatDefaults(variants: CliReference['settings']): string {
    return variants
        .map(({ setting, owners }) => {
            const defaultLevel = setting.default;
            const all = setting.default_all ?? defaultLevel;
            const shown = defaultLevel === undefined ? 'unset' : `\`${JSON.stringify(defaultLevel)}\``;
            const display = isDeepStrictEqual(defaultLevel, all)
                ? shown
                : `basic: ${shown}; all: \`${JSON.stringify(all)}\``;
            return display + (variants.length > 1 ? ' (' + owners.join(', ') + ')' : '');
        })
        .join('; ');
}

function formatLanguageDefaults(variants: CliReference['settings']): string {
    const defaults = variants.flatMap(({ setting }) =>
        setting.language_defaults === undefined ? [] : Object.entries(setting.language_defaults),
    );
    const defaultTexts = defaults.map(([language, value]) => `${language} \`${JSON.stringify(value)}\``);
    return defaultTexts.length === 0 ? '' : ` Language defaults: ${defaultTexts.join(', ')}.`;
}

function formatSetting(key: string, { node, required }: { node: SettingsSchema; required: boolean }): string {
    const variants = CLI_REFERENCE.settings.filter(({ setting }) => setting.name === key);
    const reasons = [
        ...new Set(variants.flatMap(({ setting }) => (setting.reason_when === undefined ? [] : setting.reason_when))),
    ];
    const accepted = formatAcceptedValue(CLI_REFERENCE.schema, node);
    const sentence = accepted.charAt(0).toUpperCase() + accepted.slice(1) + (SENTENCE_END.test(accepted) ? '' : '.');
    const schemaDefault = node.default === undefined ? 'unset' : `\`${JSON.stringify(node.default)}\``;
    const presence = required ? 'Required.' : `Default: ${formatDefaults(variants) || schemaDefault}.`;
    return (
        `${sentence} ${presence}` +
        (reasons.length === 0 ? '' : ` Reason needed when: ${reasons.join(', ')}.`) +
        formatLanguageDefaults(variants) +
        (node.description === undefined ? '' : `\n\n${node.description}`)
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, its test repeats at each call.
function isSettingValue(schema: SettingsSchema, node: SettingsSchema): boolean {
    return isReasonedSchema(node) || listSchemaProperties(schema, node).length === 0;
}

function formatSettingKeys(
    prefix: string,
    keys: ReturnType<typeof listSchemaProperties>,
    headingLevel: number,
): string {
    return keys
        .map(({ name, node, required }) => {
            const key = prefix === '' ? name : `${prefix}.${name}`;
            const heading = `<h${String(headingLevel)} id="${key.replaceAll(ANGLE_BRACKETS, '')}"><code>${key}</code></h${String(headingLevel)}>`;
            return `${heading}\n\n${formatSetting(key, { node, required })}\n`;
        })
        .join('\n');
}

function listVariantTables(schema: SettingsSchema, node: SettingsSchema): ReturnType<typeof listSchemaProperties> {
    const children = listSchemaProperties(schema, node);
    const names = new Set(children.filter((child) => isSettingValue(schema, child.node)).map(({ name }) => name));
    return children.filter((child) => {
        const keys = listSchemaProperties(schema, child.node).filter((schemaProperty) =>
            isSettingValue(schema, schemaProperty.node),
        );
        return !isSettingValue(schema, child.node) && keys.length > 0 && keys.every(({ name }) => names.has(name));
    });
}

function formatVariantSection(schema: SettingsSchema, key: string, node: SettingsSchema, headingLevel: number) {
    const languages = listVariantTables(schema, node);
    if (languages.length === 0) return '';
    const pattern = `${key}.${LANGUAGE_PLACEHOLDER}`;
    const categories = languages.map(({ name, node: table }) => [name, listVariantTables(schema, table)] as const);
    const categorizedLanguages = categories.filter(([, tables]) => tables.length > 0);
    const languageNames = languages.map(({ name }) => `\`${name}\``).join(', ');
    return (
        `\n${'#'.repeat(headingLevel)} \`${pattern}\`\n\n` +
        `The keys of \`[${key}]\` for one language: ${languageNames}. ` +
        `A key you leave out takes the value of \`[${key}]\`.\n` +
        (categorizedLanguages.length === 0
            ? ''
            : `\n\`${pattern}.${CATEGORY_PLACEHOLDER}\` sets the same keys for one category of names, and a key you ` +
              `leave out takes the value of \`${pattern}\`. The categories of each language:\n\n` +
              formatTable(
                  ['Language', 'Categories'],
                  categorizedLanguages.map(([name, tables]) => [
                      `\`${name}\``,
                      tables.map((table) => `\`${table.name}\``).join(', '),
                  ]),
              ) +
              '\n')
    );
}

function formatSettingTable(key: string, subschema: SettingsSchema | boolean, headingLevel: number): string {
    const { schema } = CLI_REFERENCE;
    const node = getSchemaNode(schema, subschema);
    const children = listSchemaProperties(schema, node);
    const keys = children.filter((child) => isSettingValue(schema, child.node));
    const variants = new Set(listVariantTables(schema, node).map(({ name }) => name));
    const header = node.type === 'array' ? `[[${key}]]` : `[${key}]`;
    return (
        `\n${'#'.repeat(headingLevel)} ${header}\n\n` +
        (node.description === undefined ? '' : `${node.description}\n\n`) +
        (key === 'naming' ? BANNED_NAME_MESSAGE : '') +
        (keys.length === 0 ? '' : `${formatSettingKeys(key, keys, headingLevel + 1)}\n`) +
        children
            .filter((child) => !isSettingValue(schema, child.node) && !variants.has(child.name))
            .map((child) => formatSettingTable(`${key}.${child.name}`, child.node, headingLevel + 1))
            .join('') +
        formatVariantSection(schema, key, node, headingLevel + 1)
    );
}

function formatScopeSection(subschema: SettingsSchema | boolean): string {
    const { schema } = CLI_REFERENCE;
    const node = getSchemaNode(schema, subschema);
    const children = listSchemaProperties(schema, node);
    const accepted = new Set(children.map(({ name }) => name));
    const rootOnly = listSchemaProperties(schema, schema)
        .map(({ name }) => name)
        .filter((name) => name !== 'scope' && !accepted.has(name));
    const rootOnlyNames = rootOnly.map((name) => `\`${name}\``).join(', ');
    return (
        `\n## ${node.type === 'array' ? '[[scope]]' : '[scope]'}\n\n` +
        (node.description === undefined ? '' : `${node.description}\n\n`) +
        MONOREPOS_SCOPE_MESSAGE +
        formatSettingKeys(
            'scope',
            children.filter((child) => isSettingValue(schema, child.node)),
            TABLE_HEADING_LEVEL + 1,
        ) +
        `\n\nOnly the root takes these keys: ${rootOnlyNames}.\n`
    );
}

function getSettingPath(schema: SettingsSchema, key: string): { path: string[]; node: SettingsSchema } {
    let node = schema;
    const path: string[] = [];
    for (const segment of key.split('.')) {
        const children = listSchemaProperties(schema, node);
        const child =
            children.find(({ name }) => name === segment) ?? children.find(({ name }) => name === NAME_PLACEHOLDER);
        if (child === undefined) throw new Error(`The gspot.toml schema has no setting ${key}.`);
        path.push(child.name);
        node = child.node;
    }
    return { path, node };
}

/**
Link a setting to its row, or a table or record to its heading, on the gspot.toml pages.

@param key the dotted key, such as format.indent_style or import_rule
*/
export function formatSettingLink(key: string): string {
    const { schema } = CLI_REFERENCE;
    const { path, node } = getSettingPath(schema, key);
    const name = path.join('.');
    const header = node.type === 'array' ? `[[${name}]]` : `[${name}]`;
    const anchor = isSettingValue(schema, node)
        ? name.replaceAll(ANGLE_BRACKETS, '')
        : header.toLowerCase().replaceAll(HEADING_ID_STRIPPED, '');
    return `[\`${key}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS.settings}/#${anchor})`;
}

/**
Build the settings page: the top-level keys, then every table and record, each key under its own heading.

@returns the settings page, whose table of contents lists the tables only.
*/
export function buildSettingsPage(): ReferencePage {
    const { schema } = CLI_REFERENCE;
    const roots = listSchemaProperties(schema, schema);
    const sections = roots
        .filter((child) => !isSettingValue(schema, child.node))
        .map(({ name, node }) =>
            name === 'scope' ? formatScopeSection(node) : formatSettingTable(name, node, TABLE_HEADING_LEVEL),
        );
    const topLevelKeys = roots.filter((child) => isSettingValue(schema, child.node));
    const page = buildReferencePage(
        'Settings',
        SETTINGS_DESCRIPTION,
        SETTINGS_OPENING +
            `The [JSON Schema](/${SCHEMA_FILE}) describes every key.\n` +
            formatSection(TOP_LEVEL_HEADING, formatSettingKeys('', topLevelKeys, TABLE_HEADING_LEVEL + 1)) +
            sections.join(''),
    );
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return page;
}
