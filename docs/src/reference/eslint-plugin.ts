import { readFileSync } from 'node:fs';
import plugin from '#eslint-plugin/plugin.ts';
import type { ReferencePage } from '#docs/types/pages.ts';
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { formatText, formatTable, formatSection, buildReferencePage } from '#docs/reference/markdown.ts';

import {
    HELP_HEADING,
    PURPOSE_HEADING,
    NO_CONFIG_MESSAGE,
    CONJUNCTION_FORMAT,
    SCHEMA_TYPE_LABELS,
    NO_OPTIONS_MESSAGE,
    ESLINT_FIX_MESSAGE,
    MINOR_HEADING_LEVEL,
    SUBSECTION_HEADING_LEVEL,
    DEFAULT_OPTION_DESCRIPTION,
} from '#docs/config/reference.ts';

function formatPluginPresets(): string {
    return Object.entries(plugin.configs)
        .map(([name, config]) => {
            const enabled = Object.keys(config.rules);
            const excluded = Object.keys(plugin.rules)
                .map((rule) => `${PLUGIN_PREFIX}/${rule}`)
                .filter((rule) => !enabled.includes(rule));
            if (excluded.length === 0) return `The \`${name}\` config turns on every lint rule.`;
            const names = CONJUNCTION_FORMAT.format((name === 'all' ? excluded : enabled).map((rule) => `\`${rule}\``));
            return `The \`${name}\` config turns on ${name === 'all' ? 'every lint rule except ' : ''}${names}.`;
        })
        .join('\n\n');
}

function formatRuleOptions({
    schema,
    defaultOptions,
}: (typeof plugin.rules)[keyof typeof plugin.rules]['meta']): string {
    const optionDefault = defaultOptions?.[0];
    const defaults =
        typeof optionDefault === 'object' && !Array.isArray(optionDefault)
            ? (optionDefault as Readonly<Record<string, unknown>>)
            : undefined;
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
        schemas
            .map((option, index) => {
                const type = typeof option.type === 'string' ? option.type : 'Value';
                const description = option.description ?? SCHEMA_TYPE_LABELS[type] ?? type;
                const value = defaultOptions?.[index];
                const defaultText = value === undefined ? '' : ` Default: \`${JSON.stringify(value)}\`.`;
                return `Option ${String(index + 1)}: ${formatText(description)}.${defaultText}`;
            })
            .join('\n\n') ||
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
    const sections = [
        formatSection('Why', formatText(docs.why), MINOR_HEADING_LEVEL),
        formatSection(HELP_HEADING, formatText(docs.fix), MINOR_HEADING_LEVEL),
        formatSection('Example', formatText(docs.example), MINOR_HEADING_LEVEL),
        formatSection('Options', formatRuleOptions(rule.meta), MINOR_HEADING_LEVEL),
    ];
    return formatSection(
        `\`${name}\``,
        `${formatText(docs.description)}\n\n${facts}\n${sections.join('')}`,
        SUBSECTION_HEADING_LEVEL,
    );
}

/**
Build the plugin page: how to install and use the plugin, then a section per rule. Each section names the configs
that turn the rule on, why, what to do, an example, and its options. The rule name gives its heading and anchor.
*/
export function buildPluginPage(): ReferencePage {
    const rules = Object.keys(plugin.rules)
        .toSorted((left, right) => (left < right ? -1 : Number(left > right)))
        .map((name) => [name, plugin.rules[name as keyof typeof plugin.rules]] as const);
    const readme = readFileSync(new URL('../../../packages/eslint-plugin/README.md', import.meta.url), 'utf8');
    const requirements = `Requires Node.js \`${pluginPackage.engines.node}\` and ESLint \`${pluginPackage.peerDependencies.eslint}\`. The optional magic-numbers rule needs \`@typescript-eslint/eslint-plugin\` \`${pluginPackage.peerDependencies['@typescript-eslint/eslint-plugin']}\`.`;
    const introduction = readme
        .slice(readme.indexOf('\n'))
        .trim()
        .replace('## Install\n', `## Install\n\n${requirements}\n`)
        .replace('## Use\n', `## Use\n\n${formatPluginPresets()}\n`);
    return buildReferencePage(
        pluginPackage.name,
        pluginPackage.description,
        introduction + formatSection('Rules', rules.map(([name, rule]) => formatRuleSection(name, rule)).join('')),
    );
}
