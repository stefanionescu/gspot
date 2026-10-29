import plugin from '#eslint-plugin/plugin.ts';
import { formatTable, buildReferencePage } from './markdown.ts';
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';
import type { PluginRule, ReferencePage } from '../types/reference.ts';

import {
    REFERENCE_PATH,
    FIRST_SENTENCE,
    PURPOSE_HEADING,
    REFERENCE_FOLDERS,
    NO_CONFIG_MESSAGE,
    CONJUNCTION_FORMAT,
    SCHEMA_TYPE_LABELS,
    NO_OPTIONS_MESSAGE,
    ESLINT_FIX_MESSAGE,
    DEFAULT_OPTION_DESCRIPTION,
} from '../config/reference.ts';

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

function listRuleConfigs(name: string): string[] {
    return Object.entries(plugin.configs)
        .filter(([, configuration]) => configuration.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined)
        .map(([config]) => config);
}

function formatRuleConfigs(configs: string[]): string {
    if (configs.length === 0) return NO_CONFIG_MESSAGE;
    const names = CONJUNCTION_FORMAT.format(configs.map((config) => `\`${config}\``));
    return configs.length === 1 ? `The ${names} config turns it on.` : `The ${names} configs turn it on.`;
}

/**
List the plugin rules for the plugin page: the rule, the configs that turn it on, and what it finds.

@returns one row per rule, sorted by name
*/
export function listPluginRules(): PluginRule[] {
    return Object.entries(plugin.rules)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([name, rule]) => ({
            name: `${PLUGIN_PREFIX}/${name}`,
            link: `${REFERENCE_PATH}${REFERENCE_FOLDERS['eslintPlugin']}/${name === '' ? '' : name + '/'}`,
            configs: listRuleConfigs(name),
            summary: (FIRST_SENTENCE.exec(rule.meta.docs.description)?.[0] ?? rule.meta.docs.description).trim(),
        }));
}

/**
Build the page of each plugin rule: which configs turn it on, why, what to do, an example, and its options.

@returns the pages, keyed by path inside the reference
*/
export function buildPluginPages(): Map<string, ReferencePage> {
    return new Map(
        Object.entries(plugin.rules).map(([name, rule]) => {
            const docs = rule.meta.docs;
            const facts =
                formatRuleConfigs(listRuleConfigs(name)) + (rule.meta.fixable === undefined ? '' : ESLINT_FIX_MESSAGE);
            const optionsBody = formatRuleOptions(rule.meta);
            const body = `${docs.description}\n\n${facts}\n\n## Why\n\n${docs.why}\n\n## What to do\n\n${docs.fix}\n\n## Example\n\n${docs.example}\n\n## Options\n\n${optionsBody}\n`;
            return [
                `${REFERENCE_FOLDERS.eslintPlugin}/${name}`,
                buildReferencePage(`${PLUGIN_PREFIX}/${name}`, docs.description, body),
            ];
        }),
    );
}
