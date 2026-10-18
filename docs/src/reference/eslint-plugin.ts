import plugin from '#eslint-plugin/plugin.ts';
import type { ReferencePage } from '../types/reference.ts';
import { PLUGIN_PREFIX } from '#eslint-plugin/config/plugin.ts';
import { escapeCell, formatDefinitions, buildReferencePage } from './markdown.ts';
import { REFERENCE_FOLDERS, SCHEMA_TYPE_LABELS, PLUGIN_RULE_WITHOUT_LEVEL } from '../config/reference.ts';

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
 * Build the ESLint plugin pages from the rule definitions and the levels that turn each rule on.
 * @returns the pages, keyed by path inside the reference
 */
export function buildPluginPages(): Map<string, ReferencePage> {
    // The lowest level that turns a rule on; the configurations list the levels from lowest to highest.
    const levels = new Map(
        Object.keys(plugin.rules).map((name) => {
            const level = Object.entries(plugin.configs).find(
                ([, configuration]) => configuration.rules[`${PLUGIN_PREFIX}/${name}`] !== undefined,
            )?.[0];
            return [name, level === undefined ? PLUGIN_RULE_WITHOUT_LEVEL : `\`${level}\``];
        }),
    );
    const pages = new Map(
        Object.entries(plugin.rules).map(([name, rule]) => {
            const docs = rule.meta.docs;
            const facts =
                `- Level: ${levels.get(name) ?? PLUGIN_RULE_WITHOUT_LEVEL}\n` +
                (rule.meta.fixable === undefined ? '' : '- Fixable: yes, with `eslint --fix`\n');
            const defaults: unknown = rule.meta.defaultOptions?.[0];
            const optionsBody = formatRuleOptions(rule.meta.schema, defaults);
            const description = docs.description.split('\n\n', 1).join('');
            const body = `${docs.description}\n\n## Details\n\n${facts}\n## Why\n\n${docs.why}\n\n## What to do\n\n${docs.fix}\n\n## Example\n\n${docs.example}\n\n## Options\n\n${optionsBody}\n`;
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
                            `Level: ${levels.get(name) ?? PLUGIN_RULE_WITHOUT_LEVEL}. ` +
                                escapeCell(rule.meta.docs.description.split('\n\n', 1).join('')),
                        ]),
                ),
        ),
    );
    return pages;
}
