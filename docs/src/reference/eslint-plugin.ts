import plugin from '#eslint-plugin/plugin.ts';
import type { ReferencePage } from '../types/reference.ts';
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';
import { REFERENCE_FOLDERS, SCHEMA_TYPE_LABELS } from '../config/reference.ts';
import { escapeCell, formatDefinitions, buildReferencePage } from './markdown.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatRuleOptions(schemas: unknown, defaults: unknown): string {
    const labels: Readonly<Record<string, string>> = SCHEMA_TYPE_LABELS;
    const entries: unknown[] = Array.isArray(schemas) ? schemas : [schemas];
    const rows = entries.flatMap((schema) => {
        if (!isRecord(schema) || !isRecord(schema['properties'])) return [];
        return Object.entries(schema['properties']).map(([option, shape]): [string, string] => {
            const value = isRecord(defaults) ? defaults[option] : undefined;
            const type = isRecord(shape) && typeof shape['type'] === 'string' ? shape['type'] : 'Value';
            const displayed = value === undefined ? 'unset' : escapeCell(JSON.stringify(value));
            return [
                `\`${option}\``,
                `${labels[type] ?? type}. Default: \`${displayed}\`. ${isRecord(shape) && typeof shape['description'] === 'string' ? escapeCell(shape['description']) : 'See the rule example.'}`,
            ];
        });
    });
    if (rows.length === 0) return 'This rule has no options.';
    return formatDefinitions(rows);
}

/**
 * Read standalone plugin documentation from the rule definitions and actual configurations.
 * @returns generated pages by reference-relative path
 */
export function buildPluginPages(): Map<string, ReferencePage> {
    const levels = new Map(
        Object.keys(plugin.rules).map((name) => [
            name,
            Object.entries(plugin.configs)
                .filter(([, configuration]) => configuration.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined)
                .map(([level]) => level),
        ]),
    );
    const pages = new Map(
        Object.entries(plugin.rules).map(([name, rule]) => {
            const docs = rule.meta.docs;
            const configurations = (levels.get(name) ?? []).map((level) => `\`${level}\``);
            const selected =
                configurations.length === 0
                    ? 'No level turns this rule on. Add it to your ESLint configuration for the files it should check.'
                    : `Enabled by ${configurations.join(' and ')}.`;
            const defaults: unknown = rule.meta.defaultOptions?.[0];
            const optionsBody = formatRuleOptions(rule.meta.schema, defaults);
            const description = docs.description.split('\n\n', 1).join('');
            const body = `${docs.description}\n\n${selected}\n\n## Why\n\n${docs.why}\n\n## What to do\n\n${docs.fix}\n\n## Example\n\n${docs.example}\n\n## Options\n\n${optionsBody}\n`;
            return [
                `${REFERENCE_FOLDERS.eslintPlugin}/${name}.md`,
                buildReferencePage(`${PLUGIN_PREFIX}/${name}`, description, body),
            ];
        }),
    );
    pages.set(
        `${REFERENCE_FOLDERS.eslintPlugin}/index.md`,
        buildReferencePage(
            'ESLint plugin rules',
            `${String(Object.keys(plugin.rules).length)} rules for standalone ESLint and gspot.`,
            'See [Use the ESLint plugin](/reference/eslint-plugin/use/) for standalone setup.\n\n' +
                formatDefinitions(
                    Object.entries(plugin.rules)
                        .toSorted(([a], [b]) => a.localeCompare(b))
                        .map(([name, rule]) => [
                            `[\`${PLUGIN_PREFIX}/${name}\`](/reference/${REFERENCE_FOLDERS.eslintPlugin}/${name}/)`,
                            `Level: ${(levels.get(name) ?? []).join(', ') || 'no configuration; turn it on yourself'}. ` +
                                escapeCell(rule.meta.docs.description.split('\n\n', 1).join('')),
                        ]),
                ),
        ),
    );
    return pages;
}
