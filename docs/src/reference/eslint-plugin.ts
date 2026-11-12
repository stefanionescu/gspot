import { readFileSync } from 'node:fs';

import { getRequired } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import {
    CONJUNCTION_FORMAT,
    DEFAULT_OPTION_DESCRIPTION,
    ESLINT_FIX_MESSAGE,
    HELP_HEADING,
    NO_CONFIG_MESSAGE,
    PURPOSE_HEADING,
    REFERENCE_FOLDERS,
    REFERENCE_PATH,
    SCHEMA_TYPE_LABELS,
    SENTENCE_END,
    SUBSECTION_HEADING_LEVEL,
    TABLE_HEADING_LEVEL,
    TYPE_INFORMATION_MESSAGE,
} from '#docs/config/reference.ts';
import { buildReferencePage, formatSection, formatTable, formatText } from '#docs/reference/markdown.ts';
import type { ReferencePage } from '#docs/types/pages.ts';
import pluginPackage from '#eslint-plugin-package' with { type: 'json' };
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';
import plugin from '#eslint-plugin/plugin.ts';
import { LANGUAGE_TOPICS } from '#eslint-plugin/registry/language.ts';
import { LIBRARY_TOPICS } from '#eslint-plugin/registry/libraries.ts';

const PLUGIN_PATH = `${REFERENCE_PATH}${REFERENCE_FOLDERS.eslintPlugin}/`;
const TOPICS = { ...LANGUAGE_TOPICS, ...LIBRARY_TOPICS };
const TOPIC_LABELS: Readonly<Record<keyof typeof TOPICS, string>> = {
    accessibility: 'Accessibility',
    assertions: 'Assertions',
    aws: 'AWS CDK',
    collections: 'Collections',
    'control-flow': 'Control flow',
    functions: 'Functions',
    libraries: 'Libraries',
    logic: 'Logic',
    networks: 'Networks',
    promises: 'Promises',
    react: 'React',
    regex: 'Regular expressions',
    security: 'Security',
    servers: 'Servers',
    structure: 'Code structure',
    testing: 'Tests',
    types: 'Types',
    variables: 'Variables',
    vue: 'Vue',
    web: 'Web',
};

function formatPluginPresets(): string {
    const presets = Object.entries(plugin.configs).map(([name, config]) => {
        const enabled = Object.keys(config.rules);
        const excluded = Object.keys(plugin.rules)
            .map((rule) => `${PLUGIN_PREFIX}/${rule}`)
            .filter((rule) => !enabled.includes(rule));
        if (excluded.length === 0) return `The \`${name}\` config turns on every lint rule.`;
        if (name !== 'all') return `The \`${name}\` config turns on ${String(enabled.length)} rules.`;
        const names = CONJUNCTION_FORMAT.format(excluded.map((rule) => `\`${rule}\``));
        return `The \`${name}\` config turns on every lint rule except ${names}.`;
    });
    return presets.join(' ');
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
                const end = SENTENCE_END.test(description) ? '' : '.';
                const defaultText = value === undefined ? '' : ` Default: \`${JSON.stringify(value)}\`.`;
                return `Option ${String(index + 1)}: ${formatText(description)}${end}${defaultText}`;
            })
            .join('\n\n')
    );
}

function formatRuleConfigs(name: string): string {
    const configs = Object.entries(plugin.configs)
        .filter(([, configuration]) => configuration.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined)
        .map(([config]) => config);
    if (configs.length === 0) return NO_CONFIG_MESSAGE;
    const names = CONJUNCTION_FORMAT.format(configs.map((config) => `\`${config}\``));
    return configs.length === 1 ? `On in the ${names} config.` : `On in the ${names} configs.`;
}

function formatRuleSection(name: string, rule: (typeof plugin.rules)[keyof typeof plugin.rules]): string {
    const { docs } = rule.meta;
    if (docs === undefined) throw new Error(`The plugin rule ${name} has no docs.`);
    const facts =
        formatRuleConfigs(name) +
        (rule.meta.fixable === undefined ? '' : ESLINT_FIX_MESSAGE) +
        (docs.requiresTypeChecking === true ? TYPE_INFORMATION_MESSAGE : '');
    const sections = [
        formatSection('Why', formatText(docs.why), SUBSECTION_HEADING_LEVEL),
        formatSection(HELP_HEADING, formatText(docs.fix), SUBSECTION_HEADING_LEVEL),
        formatSection('Example', formatText(docs.example), SUBSECTION_HEADING_LEVEL),
        formatSection('Options', formatRuleOptions(rule.meta), SUBSECTION_HEADING_LEVEL),
    ];
    return formatSection(
        `\`${name}\``,
        `${formatText(docs.description)}\n\n${facts}\n${sections.join('')}`,
        TABLE_HEADING_LEVEL,
    );
}

function formatTopicIndex(topic: string, label: string, names: readonly string[]): string {
    const path = `${PLUGIN_PATH}${topic}/`;
    const links = names.map((name) => `<li id="${name}"><a href="${path}#${name}"><code>${name}</code></a></li>`);
    return formatSection(
        `[${label}](${path})`,
        `<ul class="rule-index">\n${links.join('\n')}\n</ul>`,
        SUBSECTION_HEADING_LEVEL,
    );
}

function buildTopicPage(label: string, names: readonly string[]): ReferencePage {
    const rules = new Map(Object.entries(plugin.rules));
    const page = buildReferencePage(
        `${label} rules`,
        undefined,
        names.map((name) => formatRuleSection(name, getRequired(rules, name, 'plugin rule'))).join(''),
    );
    page.data.tableOfContents = { maxHeadingLevel: TABLE_HEADING_LEVEL };
    return page;
}

export function buildPluginPages(): Map<string, ReferencePage> {
    const topics = (Object.keys(TOPICS) as Array<keyof typeof TOPICS>).toSorted(compareText).map((topic) => ({
        topic,
        label: TOPIC_LABELS[topic],
        names: TOPICS[topic].map(({ name }) => name).toSorted(compareText),
    }));
    const readme = readFileSync(new URL('../../../packages/eslint-plugin/README.md', import.meta.url), 'utf8');
    const requirements = `Requires Node.js \`${pluginPackage.engines.node}\` and ESLint \`${pluginPackage.peerDependencies.eslint}\`. The optional magic-numbers rule needs \`@typescript-eslint/eslint-plugin\` \`${pluginPackage.peerDependencies['@typescript-eslint/eslint-plugin']}\`.`;
    for (const heading of ['## Install\n', '## Use\n', '## Rule reference'])
        if (!readme.includes(heading)) throw new Error(`The plugin README lost its heading ${heading.trim()}.`);
    const introduction = readme
        .slice(readme.indexOf('\n'), readme.indexOf('## Rule reference'))
        .trim()
        .replace('## Install\n', () => `## Install\n\n${requirements}\n`)
        .replace('## Use\n', () => `## Use\n\n${formatPluginPresets()}\n`);
    const index = buildReferencePage(
        pluginPackage.name,
        pluginPackage.description,
        introduction +
            formatSection(
                'Rules',
                topics.map(({ topic, label, names }) => formatTopicIndex(topic, label, names)).join(''),
            ),
    );
    return new Map([
        [`${REFERENCE_FOLDERS.eslintPlugin}/index`, index],
        ...topics.map(
            ({ topic, label, names }) =>
                [`${REFERENCE_FOLDERS.eslintPlugin}/${topic}`, buildTopicPage(label, names)] as const,
        ),
    ]);
}
