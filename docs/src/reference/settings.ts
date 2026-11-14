import { isDeepStrictEqual } from 'node:util';
import type { ReferencePage } from '#docs/types/pages.ts';
import { DOCS_PATHS, CLI_REFERENCE } from '@gspothq/cli/reference';
import type { SettingVariant, SettingReference, AcceptedSettingValues } from '#docs/types/reference.ts';
import { formatText, formatTable, formatSection, buildReferencePage } from '#docs/reference/markdown.ts';

import {
    SENTENCE_END,
    ANGLE_BRACKETS,
    REFERENCE_PATH,
    NAME_PLACEHOLDER,
    TOP_LEVEL_ANCHOR,
    REFERENCE_FOLDERS,
    TOP_LEVEL_HEADING,
    SCHEMA_TYPE_LABELS,
    BANNED_NAME_MESSAGE,
    LISTED_VALUES_LIMIT,
    TABLE_HEADING_LEVEL,
    CATEGORY_PLACEHOLDER,
    LANGUAGE_PLACEHOLDER,
    REASONED_VALUE_LABEL,
    MONOREPOS_SCOPE_MESSAGE,
} from '#docs/config/reference.ts';

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
                choices.map(({ value, description = '' }) => [`\`${JSON.stringify(value)}\``, description]),
            )}\n\n`;
        return choices.map(({ value }) => `\`${JSON.stringify(value)}\``).join(', ');
    }
    return [
        ...types.map((type) => SCHEMA_TYPE_LABELS[type] ?? type),
        ...alternatives.map((alternative) => formatAcceptedValue(alternative)),
    ].join(' or ');
}

function formatReasonedValue({ alternatives }: AcceptedSettingValues): string {
    const values = alternatives.filter(({ types }) => !types.includes('object'));
    return values.map((value) => formatAcceptedValue(value)).join(' or ');
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
            return display + (variants.length > 1 ? ` (${owners.join(', ')})` : '');
        })
        .join('; ');
}

function formatLanguageDefaults(variants: SettingVariant[]): string {
    const defaults = variants.flatMap(({ setting }) =>
        setting.language_defaults === undefined ? [] : Object.entries(setting.language_defaults),
    );
    const defaultTexts = defaults.map(([language, value]) => `${language} \`${JSON.stringify(value)}\``);
    return defaultTexts.length === 0 ? '' : `Language defaults: ${defaultTexts.join(', ')}.`;
}

function formatPresence({ required, default: schemaValue, variants }: SettingReference): string {
    if (required) return 'Required.';
    const schemaDefault = schemaValue === undefined ? 'unset' : `\`${JSON.stringify(schemaValue)}\``;
    const shown = formatDefaults(variants) || schemaDefault;
    return shown === 'unset' ? '' : `Default: ${shown}.`;
}

function formatSentenceStart(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatSetting(node: SettingReference): string {
    const { variants } = node;
    const reasons = [...new Set(variants.flatMap(({ setting }) => setting.reason_for ?? []))];
    const accepted = node.reasoned ? formatReasonedValue(node.accepted) : formatAcceptedValue(node.accepted);
    const facts = [
        formatSentenceStart(accepted) + (SENTENCE_END.test(accepted) ? '' : '.'),
        formatPresence(node),
        reasons.length === 0
            ? ''
            : `${formatSentenceStart(reasons.join(' or '))} needs a reason: ${REASONED_VALUE_LABEL}.`,
        formatLanguageDefaults(variants),
    ];
    return (
        facts.filter(Boolean).join(' ') + (node.description === undefined ? '' : `\n\n${formatText(node.description)}`)
    );
}

function formatSettingKeys(nodes: SettingReference[], headingLevel: number): string {
    return nodes
        .map((node) =>
            formatSection(
                `\`${node.key}\``,
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
        `\`${pattern}\``,
        `The keys of \`[${node.key}]\` for one language: ${names}. ` +
            `A key you leave out takes the value of \`[${node.key}]\`.\n${
                categories.length === 0
                    ? ''
                    : `\n\`${pattern}.${CATEGORY_PLACEHOLDER}\` sets the same keys for one category of names, and a key you ` +
                      `leave out takes the value of \`${pattern}\`. The categories of each language:\n\n${formatTable(
                          ['Language', 'Categories'],
                          categories.map(([name, tables]) => [
                              `\`${name}\``,
                              tables.map((table) => `\`${table.name}\``).join(', '),
                          ]),
                      )}\n`
            }`,
        headingLevel,
        buildSettingAnchor(pattern, 'table'),
    );
}

function formatTableHeader(node: SettingReference): string {
    return node.kind === 'record' ? `[[${node.key}]]` : `[${node.key}]`;
}

function formatSettingTable(node: SettingReference, headingLevel: number): string {
    const header = formatTableHeader(node);
    const keys = node.children.filter((child) => child.kind === 'value');
    return formatSection(
        `\`${header}\``,
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
        '`[[scope]]`',
        `${
            (node.description === undefined ? '' : `${formatText(node.description)}\n\n`) +
            MONOREPOS_SCOPE_MESSAGE +
            formatSettingKeys(
                node.children.filter((child) => child.kind === 'value'),
                TABLE_HEADING_LEVEL + 1,
            )
        }\n\nOnly the root takes these settings: ${rootOnlyNames}.\n`,
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

export function formatSettingLink(key: string): string {
    const heading = getSettingHeading(key);
    const anchor = buildSettingAnchor(heading.key, heading.kind);
    return `[\`${key}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS.settings}/#${anchor})`;
}

export function buildSettingsPage(): ReferencePage {
    const roots = CLI_REFERENCE.settings;
    const topLevelKeys = roots.filter((node) => node.kind === 'value');
    const sections = roots
        .filter((node) => node.kind !== 'value')
        .map((node) =>
            node.name === 'scope' ? formatScopeSection(node) : formatSettingTable(node, TABLE_HEADING_LEVEL),
        );
    const page = buildReferencePage(
        'gspot.toml settings',
        undefined,
        `[gspot.toml](/configure/gspot-toml/) says how to change these settings, and the [JSON Schema](${DOCS_PATHS.schema}) gives your editor the same keys.\n${formatSection(
            TOP_LEVEL_HEADING,
            formatSettingKeys(topLevelKeys, TABLE_HEADING_LEVEL + 1),
            TABLE_HEADING_LEVEL,
            TOP_LEVEL_ANCHOR,
        )}${sections.join('')}`,
    );
    page.headings = [
        { depth: TABLE_HEADING_LEVEL, slug: TOP_LEVEL_ANCHOR, text: TOP_LEVEL_HEADING },
        ...roots
            .filter((node) => node.kind !== 'value')
            .map((node) => ({
                depth: TABLE_HEADING_LEVEL,
                slug: buildSettingAnchor(node.key, node.kind),
                text: formatTableHeader(node),
            })),
    ];
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return page;
}
