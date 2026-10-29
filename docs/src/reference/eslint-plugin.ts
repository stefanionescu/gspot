import plugin from '#eslint-plugin/plugin.ts';
import type { ReferencePage } from '#docs/types/reference.ts';
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';
import { formatTable, formatSection, buildReferencePage } from '#docs/reference/markdown.ts';

import {
    PLUGIN_TITLE,
    PLUGIN_OPENING,
    PURPOSE_HEADING,
    NO_CONFIG_MESSAGE,
    CONJUNCTION_FORMAT,
    SCHEMA_TYPE_LABELS,
    NO_OPTIONS_MESSAGE,
    ESLINT_FIX_MESSAGE,
    PLUGIN_DESCRIPTION,
    MINOR_HEADING_LEVEL,
    SUBSECTION_HEADING_LEVEL,
    DEFAULT_OPTION_DESCRIPTION,
} from '#docs/config/reference.ts';

function formatRuleOptions({
    schema,
    defaultOptions,
}: (typeof plugin.rules)[keyof typeof plugin.rules]['meta']): string {
    const defaults: Readonly<Record<string, unknown>> | undefined = defaultOptions?.[0];
    const schemas = [schema].flat();
    const rows = schemas
        .flatMap((option) =>
            'properties' in option && option.properties !== undefined ? Object.entries(option.properties) : [],
        )
        .map(([name, shape]) => {
            const value = defaults?.[name];
            const type = typeof shape.type === 'string' ? shape.type : 'Value';
            return [
                `\`${name}\``,
                SCHEMA_TYPE_LABELS[type] ?? type,
                value === undefined ? 'Unset' : `\`${JSON.stringify(value)}\``,
                shape.description ?? DEFAULT_OPTION_DESCRIPTION,
            ];
        });
    return (
        formatTable(['Option', 'Type', 'Default', PURPOSE_HEADING], rows) ||
        schemas.flatMap((option) => option.description ?? []).join('\n\n') ||
        NO_OPTIONS_MESSAGE
    );
}

function formatRuleConfigs(name: string): string {
    const configs = Object.entries(plugin.configs)
        .filter(([, configuration]) => configuration.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined)
        .map(([config]) => config);
    if (configs.length === 0) return NO_CONFIG_MESSAGE;
    const names = CONJUNCTION_FORMAT.format(configs.map((config) => `\`${config}\``));
    const rule = `\`${PLUGIN_PREFIX}/${name}\``;
    return configs.length === 1 ? `The ${names} config turns on ${rule}.` : `The ${names} configs turn on ${rule}.`;
}

function formatRuleSection(name: string, rule: (typeof plugin.rules)[keyof typeof plugin.rules]): string {
    const { docs } = rule.meta;
    if (docs === undefined) throw new Error(`The plugin rule ${name} has no docs.`);
    const facts = formatRuleConfigs(name) + (rule.meta.fixable === undefined ? '' : ESLINT_FIX_MESSAGE);
    const heading = `${'#'.repeat(SUBSECTION_HEADING_LEVEL)} \`${name}\``;
    const sections = [
        formatSection('Why', docs.why, MINOR_HEADING_LEVEL),
        formatSection('What to do', docs.fix, MINOR_HEADING_LEVEL),
        formatSection('Example', docs.example, MINOR_HEADING_LEVEL),
        formatSection('Options', formatRuleOptions(rule.meta), MINOR_HEADING_LEVEL),
    ];
    return `\n${heading}\n\n${docs.description}\n\n${facts}\n${sections.join('')}`;
}

/**
Build the plugin page: how to install and use the plugin, then a section per rule. Each section names the configs
that turn the rule on, why, what to do, an example, and its options. The rule name gives its heading and anchor.
*/
export function buildPluginPage(): ReferencePage {
    const rules = Object.entries(plugin.rules).toSorted(([left], [right]) => left.localeCompare(right));
    return buildReferencePage(
        PLUGIN_TITLE,
        PLUGIN_DESCRIPTION,
        PLUGIN_OPENING + formatSection('Rules', rules.map(([name, rule]) => formatRuleSection(name, rule)).join('')),
    );
}
