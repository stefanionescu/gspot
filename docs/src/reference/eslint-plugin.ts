import { isRecord } from '#cli/objects.ts';
import plugin from '#eslint-plugin/plugin.ts';
import { REFERENCE_FOLDERS } from '../config/reference.ts';
import type { ReferencePage } from '../types/reference.ts';
import { cell, table, referencePage } from './markdown.ts';
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';

function pluginOptions(schemas: unknown, defaults: unknown): string {
    const entries: unknown[] = Array.isArray(schemas) ? schemas : [schemas];
    const rows = entries.flatMap((schema) => {
        if (!isRecord(schema) || !isRecord(schema['properties'])) return [];
        return Object.entries(schema['properties']).map(([option, shape]) => {
            const value = isRecord(defaults) ? defaults[option] : undefined;
            const type = isRecord(shape) && typeof shape['type'] === 'string' ? shape['type'] : 'Value';
            const displayed = value === undefined ? 'unset' : cell(JSON.stringify(value));
            return [
                `\`${option}\``,
                type,
                `\`${displayed}\``,
                isRecord(shape) && typeof shape['description'] === 'string'
                    ? cell(shape['description'])
                    : 'See the rule example.',
            ];
        });
    });
    if (rows.length === 0) return 'This rule has no options.';
    return table(['Option', 'Accepted value', 'Default', 'Meaning'], rows);
}

/**
 * Read standalone plugin documentation from the rule definitions and actual configurations.
 * @returns generated pages by reference-relative path
 */
export function pluginReferencePages(): Map<string, ReferencePage> {
    const pages = new Map(
        Object.entries(plugin.rules).map(([name, rule]) => {
            const docs = rule.meta.docs;
            const configurations = Object.entries(plugin.configs)
                .filter(([, configuration]) => configuration.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined)
                .map(([level]) => `\`${level}\``);
            const selected =
                configurations.length === 0
                    ? 'No level turns this rule on. Add it to your ESLint configuration for the files it should check.'
                    : `Enabled by ${configurations.join(' and ')}.`;
            const defaults: unknown = rule.meta.defaultOptions?.[0];
            const optionsBody = pluginOptions(rule.meta.schema, defaults);
            const description = docs.description.split('\n\n', 1).join('');
            const body = `Rule: \`${PLUGIN_PREFIX}/${name}\`.\n\n${docs.description}\n\n${selected}\n\n## Why\n\n${docs.why}\n\n## What to do\n\n${docs.fix}\n\n## Example\n\n${docs.example}\n\n## Options\n\n${optionsBody}\n`;
            return [
                `${REFERENCE_FOLDERS.eslintPlugin}/${name}.md`,
                referencePage(`${PLUGIN_PREFIX}/${name}`, description, body),
            ];
        }),
    );
    pages.set(
        `${REFERENCE_FOLDERS.eslintPlugin}/index.md`,
        referencePage(
            'ESLint plugin rules',
            `${String(Object.keys(plugin.rules).length)} rules for standalone ESLint and gspot.`,
            table(
                ['Rule', 'Level', 'Summary'],
                Object.entries(plugin.rules)
                    .toSorted(([a], [b]) => a.localeCompare(b))
                    .map(([name, rule]) => [
                        `[\`${PLUGIN_PREFIX}/${name}\`](/reference/${REFERENCE_FOLDERS.eslintPlugin}/${name}/)`,
                        Object.entries(plugin.configs)
                            .filter(([, preset]) => preset.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined)
                            .map(([level]) => level)
                            .join(', ') || 'none',
                        cell(rule.meta.docs.description.split('\n\n', 1).join('')),
                    ]),
            ),
        ),
    );
    return pages;
}
