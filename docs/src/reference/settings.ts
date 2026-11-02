import { isDeepStrictEqual } from 'node:util';
import { CLI_REFERENCE } from '#cli/reference.ts';
import type { ReferencePage } from '#docs/types/pages.ts';
import type { SettingVariant, SettingReference, AcceptedSettingValues } from '#docs/types/reference.ts';
import { formatText, formatTable, formatSection, buildReferencePage } from '#docs/reference/markdown.ts';

import {
    SENTENCE_END,
    REFERENCE_PATH,
    ANGLE_BRACKETS,
    SETTINGS_OPENING,
    NAME_PLACEHOLDER,
    REFERENCE_FOLDERS,
    TOP_LEVEL_HEADING,
    SCHEMA_TYPE_LABELS,
    BANNED_NAME_MESSAGE,
    LISTED_VALUES_LIMIT,
    TABLE_HEADING_LEVEL,
    SETTINGS_DESCRIPTION,
    CATEGORY_PLACEHOLDER,
    LANGUAGE_PLACEHOLDER,
    REASONED_VALUE_LABEL,
    MONOREPOS_SCOPE_MESSAGE,
} from '#docs/config/reference.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Setting headings and links must calculate the same explicit ID.
function buildSettingAnchor(key: string, kind: SettingReference['kind']): string {
    const name = key.replaceAll(ANGLE_BRACKETS, '');
    return kind === 'value' ? name : name.toLowerCase().replaceAll('.', '');
}

function formatAcceptedValue(accepted: AcceptedSettingValues): string {
    const { choices, alternatives, types } = accepted;
    if (choices.length > LISTED_VALUES_LIMIT) return `One of ${String(choices.length)} names`;
    if (choices.length > 0) {
        if (choices.every(({ description }) => description !== undefined))
            return `One of these values:\n\n${formatTable(
                ['Value', 'Meaning'],
                choices.map(({ value, description }) => [`\`${JSON.stringify(value)}\``, description ?? '']),
            )}\n\n`;
        return choices.map(({ value }) => `\`${JSON.stringify(value)}\``).join(', ');
    }
    return [
        ...types.map((type) => SCHEMA_TYPE_LABELS[type] ?? type),
        ...alternatives.map((alternative) => formatAcceptedValue(alternative)),
    ].join(' or ');
}

function formatDefaults(variants: SettingVariant[]): string {
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

function formatLanguageDefaults(variants: SettingVariant[]): string {
    const defaults = variants.flatMap(({ setting }) =>
        setting.language_defaults === undefined ? [] : Object.entries(setting.language_defaults),
    );
    const defaultTexts = defaults.map(([language, value]) => `${language} \`${JSON.stringify(value)}\``);
    return defaultTexts.length === 0 ? '' : ` Language defaults: ${defaultTexts.join(', ')}.`;
}

function formatSetting(node: SettingReference): string {
    const { variants, required } = node;
    const reasons = [...new Set(variants.flatMap(({ setting }) => setting.reason_when ?? []))];
    const accepted = node.reasoned ? REASONED_VALUE_LABEL : formatAcceptedValue(node.accepted);
    const sentence = accepted.charAt(0).toUpperCase() + accepted.slice(1) + (SENTENCE_END.test(accepted) ? '' : '.');
    const schemaDefault = node.default === undefined ? 'unset' : `\`${JSON.stringify(node.default)}\``;
    const presence = required ? 'Required.' : `Default: ${formatDefaults(variants) || schemaDefault}.`;
    return (
        `${sentence} ${presence}` +
        (reasons.length === 0 ? '' : ` Reason needed when: ${reasons.join(', ')}.`) +
        formatLanguageDefaults(variants) +
        (node.description === undefined ? '' : `\n\n${formatText(node.description)}`)
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Root keys, tables, and scopes share this heading and anchor renderer.
function formatSettingKeys(nodes: SettingReference[], headingLevel: number): string {
    return nodes
        .map((node) =>
            formatSection(
                `<code>${formatText(node.key)}</code>`,
                formatSetting(node),
                headingLevel,
                buildSettingAnchor(node.key, node.kind),
            ),
        )
        .join('\n');
}

function formatVariantSection(node: SettingReference, headingLevel: number): string {
    const languages = node.children.filter((child) => child.variantOf !== undefined);
    if (languages.length === 0) return '';
    const pattern = `${node.key}.${LANGUAGE_PLACEHOLDER}`;
    const categories = languages
        .map((language) => [language.name, language.children.filter((child) => child.variantOf !== undefined)] as const)
        .filter(([, tables]) => tables.length > 0);
    const names = languages.map(({ name }) => `\`${name}\``).join(', ');
    return formatSection(
        `<code>${formatText(pattern)}</code>`,
        `The keys of \`[${node.key}]\` for one language: ${names}. ` +
            `A key you leave out takes the value of \`[${node.key}]\`.\n` +
            (categories.length === 0
                ? ''
                : `\n\`${pattern}.${CATEGORY_PLACEHOLDER}\` sets the same keys for one category of names, and a key you ` +
                  `leave out takes the value of \`${pattern}\`. The categories of each language:\n\n` +
                  formatTable(
                      ['Language', 'Categories'],
                      categories.map(([name, tables]) => [
                          `\`${name}\``,
                          tables.map((table) => `\`${table.name}\``).join(', '),
                      ]),
                  ) +
                  '\n'),
        headingLevel,
        buildSettingAnchor(pattern, 'table'),
    );
}

function formatSettingTable(node: SettingReference, headingLevel: number): string {
    const header = node.kind === 'record' ? `[[${node.key}]]` : `[${node.key}]`;
    const keys = node.children.filter((child) => child.kind === 'value');
    return formatSection(
        `<code>${formatText(header)}</code>`,
        (node.description === undefined ? '' : `${formatText(node.description)}\n\n`) +
            (node.key === 'naming' ? BANNED_NAME_MESSAGE : '') +
            (keys.length === 0 ? '' : `${formatSettingKeys(keys, headingLevel + 1)}\n`) +
            node.children
                .filter((child) => child.kind !== 'value' && child.variantOf === undefined)
                .map((child) => formatSettingTable(child, headingLevel + 1))
                .join('') +
            formatVariantSection(node, headingLevel + 1),
        headingLevel,
        buildSettingAnchor(node.key, node.kind),
    );
}

function formatScopeSection(node: SettingReference): string {
    const rootOnlyNames = CLI_REFERENCE.settings
        .filter((child) => child.name !== 'scope' && child.rootOnly)
        .map(({ name }) => `\`${name}\``)
        .join(', ');
    return formatSection(
        '[[scope]]',
        (node.description === undefined ? '' : `${formatText(node.description)}\n\n`) +
            MONOREPOS_SCOPE_MESSAGE +
            formatSettingKeys(
                node.children.filter((child) => child.kind === 'value'),
                TABLE_HEADING_LEVEL + 1,
            ) +
            `\n\nOnly the root takes these keys: ${rootOnlyNames}.\n`,
        TABLE_HEADING_LEVEL,
        buildSettingAnchor(node.key, node.kind),
    );
}

function getSettingHeading(key: string): { key: string; kind: SettingReference['kind'] } {
    let children = CLI_REFERENCE.settings;
    let heading;
    for (const segment of key.split('.')) {
        const child =
            children.find(({ name }) => name === segment) ?? children.find(({ name }) => name === NAME_PLACEHOLDER);
        if (child === undefined) throw new Error(`The gspot.toml schema has no setting ${key}.`);
        if (child.variantOf !== undefined) return { key: `${child.variantOf}.${LANGUAGE_PLACEHOLDER}`, kind: 'table' };
        heading = child;
        children = child.children;
    }
    if (heading === undefined) throw new Error('A setting link needs a nonempty key.');
    return heading;
}

/**
Link a setting to its heading on the gspot.toml page.

@param key the dotted key, such as format.indent_style or import_rule.
*/
export function formatSettingLink(key: string): string {
    const heading = getSettingHeading(key);
    const anchor = buildSettingAnchor(heading.key, heading.kind);
    return `[\`${key}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS.settings}/#${anchor})`;
}

/**
Build the settings page from the CLI's documented tree, with one explicit anchor for every heading.
*/
export function buildSettingsPage(): ReferencePage {
    const roots = CLI_REFERENCE.settings;
    const sections = roots
        .filter((node) => node.kind !== 'value')
        .map((node) =>
            node.name === 'scope' ? formatScopeSection(node) : formatSettingTable(node, TABLE_HEADING_LEVEL),
        );
    const page = buildReferencePage(
        'gspot.toml Settings',
        SETTINGS_DESCRIPTION,
        SETTINGS_OPENING +
            `The [JSON Schema](${CLI_REFERENCE.docs.schema}) describes every key.\n` +
            formatSection(
                TOP_LEVEL_HEADING,
                formatSettingKeys(
                    roots.filter((node) => node.kind === 'value'),
                    TABLE_HEADING_LEVEL + 1,
                ),
                TABLE_HEADING_LEVEL,
                'top-level-keys',
            ) +
            sections.join(''),
    );
    page.headings = [
        { depth: TABLE_HEADING_LEVEL, slug: 'top-level-keys', text: TOP_LEVEL_HEADING },
        ...roots
            .filter((node) => node.kind !== 'value')
            .map((node) => ({
                depth: TABLE_HEADING_LEVEL,
                slug: buildSettingAnchor(node.key, node.kind),
                text: node.kind === 'record' ? `[[${node.key}]]` : `[${node.key}]`,
            })),
    ];
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return page;
}
