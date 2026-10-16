import { isDeepStrictEqual } from 'node:util';
import type { JSONSchema } from 'zod/v4/core';
import type { referenceData } from '#cli/reference.ts';
import type { ReferencePage } from '../types/reference.ts';
import { LANGUAGE_SETTING, SETTINGS_SUBPAGES, SCHEMA_TYPE_LABELS } from '../config/reference.ts';
import { escapeCell, formatSection, formatDefinitions, buildReferencePage } from './markdown.ts';

function getSchemaNode(schema: JSONSchema.JSONSchema, value: JSONSchema.JSONSchema | boolean): JSONSchema.JSONSchema {
    if (typeof value === 'boolean') return value ? {} : { not: {} };
    let node = value;
    while (node.$ref !== undefined) {
        const { $ref: reference, ...local } = node;
        // buildJsonSchema writes every local reference into $defs.
        const schemas = schema.$defs as Record<string, JSONSchema.JSONSchema>;
        const definition = schemas[reference.slice('#/$defs/'.length)] as JSONSchema.JSONSchema;
        node = { ...definition, ...local };
    }
    return node;
}

function formatAcceptedValue(schema: JSONSchema.JSONSchema, value: JSONSchema.JSONSchema | boolean): string {
    const node = getSchemaNode(schema, value);
    if (node.const !== undefined)
        return [`\`${JSON.stringify(node.const)}\``, node.description]
            .filter((entry) => entry !== undefined)
            .map((entry) => escapeCell(entry))
            .join(': ');
    if (node.enum !== undefined) return node.enum.map((value) => `\`${JSON.stringify(value)}\``).join(', ');
    if (node.anyOf !== undefined)
        return [...new Set(node.anyOf.map((entry) => formatAcceptedValue(schema, entry)))].join(' or ');
    const labels: Readonly<Record<string, string>> = SCHEMA_TYPE_LABELS;
    return [node.type ?? 'Value']
        .flat()
        .map((type) => labels[type] ?? type)
        .join(' or ');
}

function listSchemaProperties(
    schema: JSONSchema.JSONSchema,
    value: JSONSchema.JSONSchema | boolean,
): Array<[string, JSONSchema.JSONSchema | boolean]> {
    const node = getSchemaNode(schema, value);
    const child = node.items ?? node.additionalProperties;
    const shape = typeof child === 'object' && !Array.isArray(child) ? getSchemaNode(schema, child) : node;
    if (shape.properties === undefined) return [];
    return Object.entries(shape.properties).map(([name, node]) => [name, getSchemaNode(schema, node)]);
}

function formatSetting(
    schema: JSONSchema.JSONSchema,
    name: string,
    value: JSONSchema.JSONSchema | boolean,
    data: ReturnType<typeof referenceData>,
): [string, string] {
    const language = LANGUAGE_SETTING.exec(name)?.groups?.['language'];
    const declared = data.settings.filter(({ setting }) => setting.name === name);
    const variants =
        declared.length > 0 || language === undefined
            ? declared
            : data.settings
                  .filter(({ setting }) => setting.name === name.replace(LANGUAGE_SETTING, '$1.$3'))
                  .map(({ setting, owners }) => ({
                      setting: { ...setting, default: setting.language_defaults?.[language] ?? setting.default },
                      owners,
                  }));
    const node = getSchemaNode(schema, value);
    const defaults = variants
        .map(({ setting, owners }) => {
            const recommended = setting.default;
            const all = setting.default_all ?? recommended;
            const shown = recommended === undefined ? 'unset' : `\`${JSON.stringify(recommended)}\``;
            const display = isDeepStrictEqual(recommended, all)
                ? shown
                : `recommended: ${shown}; all: \`${JSON.stringify(all)}\``;
            return display + (variants.length > 1 ? ' (' + owners.join(', ') + ')' : '');
        })
        .join('; ');
    const reasons = [
        ...new Set(
            variants.flatMap(({ setting }) => (setting.reason_needed === undefined ? [] : [setting.reason_needed])),
        ),
    ];
    return [
        `\`${name}\``,
        `${formatAcceptedValue(schema, value)}. Default: ${defaults || 'unset'}.` +
            (reasons.length === 0 ? '' : ` Reason needed when: ${reasons.join(', ')}.`) +
            (node.description === undefined ? '' : ` ${escapeCell(node.description)}`),
    ];
}

function formatSettingKeys(
    schema: JSONSchema.JSONSchema,
    prefix: string,
    value: JSONSchema.JSONSchema | boolean,
    data: ReturnType<typeof referenceData>,
): string {
    const rows: [string, string][] = [];
    function collect(name: string, node: JSONSchema.JSONSchema | boolean): void {
        const children = listSchemaProperties(schema, node);
        if (children.length === 0) rows.push(formatSetting(schema, name, node, data));
        else for (const [child, shape] of children) collect(name === '' ? child : `${name}.${child}`, shape);
    }
    collect(prefix, value);
    return formatDefinitions(rows);
}

function formatLimitsGuide(data: ReturnType<typeof referenceData>): string {
    const { setting } = data.settings.find(
        ({ setting }) => setting.name.startsWith('limits.') && setting.reason_needed === 'raising',
    ) as ReturnType<typeof referenceData>['settings'][number];
    const key = setting.name;
    const value = Number(setting.default) + 1;
    return (
        `Change a limit for the repository, or use \`limits.<language>.<name>\` for one language. A value that loosens a check needs a reason.\n\n` +
        `\`\`\`shell\ngspot set ${key} ${String(value)} --reason "The parser is one state machine."\n\`\`\`\n\n` +
        `\`\`\`toml\nconfigurations = ["bash"]\nlevel = "all"\n\n[limits]\n${key.slice('limits.'.length)} = { value = ${String(value)}, reason = "The parser is one state machine." }\n\`\`\`\n\n` +
        `For one language, set \`${key.replace('limits.', 'limits.bash.')}\` instead. Its recommended default is \`${JSON.stringify(setting.default)}\`.\n\n` +
        `For a Bash function over this nesting limit, \`bash/function-size\` reports:\n\n\`\`\`text\nmain has ${String(value)} levels of nesting, over the limit of ${String(setting.default)}.\n\`\`\`\n\n` +
        `The raised limit accepts that depth. To inspect the current value and source, run \`gspot explain ${key}\`.\n\n`
    );
}

function formatScopeGuide(node: JSONSchema.JSONSchema | boolean, data: ReturnType<typeof referenceData>): string {
    const properties = listSchemaProperties(data.schema, node);
    return (
        'A scope selects settings for a folder. See [Monorepos and scopes](/configure/monorepos/) for inheritance.\n\n' +
        formatDefinitions(
            properties
                .filter(([key]) => key === 'path')
                .map(([, value]) => formatSetting(data.schema, 'scope.path', value, data)),
        ) +
        '\n\nAccepted root sections:\n\n' +
        properties
            .filter(([key]) => key !== 'path')
            .map(
                ([key]) =>
                    `- [\`${key}\`](/reference/gspot-toml/${SETTINGS_SUBPAGES.includes(key) ? key + '/' : '#' + key})`,
            )
            .join('\n')
    );
}

function formatNamingGuide(data: ReturnType<typeof referenceData>): string {
    const { setting } = data.settings.find(({ setting }) => setting.name === 'naming.max_words') as ReturnType<
        typeof referenceData
    >['settings'][number];
    const value = Number(setting.default) + 1;
    return (
        'Allow an exact name only when an external contract requires it. Every shipped banned naming group applies at level `all`. The `roles` group rejects vague job labels such as `helper` and `manager`; `defensive` rejects qualifiers such as `ensure` and `maybe`; `marketing` rejects claims such as `advanced` and `enhanced`. `naming.banned_words` adds project words.\n\n' +
        'For `export const helperCommand = 1;`, `naming/identifiers` reports:\n\n```text\njavascript variable "helperCommand": "helper" is banned (roles group).\n```\n\n' +
        'This complete example accepts that exact variable name in one file:\n\n```toml\nconfigurations = ["javascript", "naming"]\nlevel = "all"\n\n[[naming.override]]\npaths = ["helper.js"]\ncategories = ["variables"]\nallowed_names = ["helperCommand"]\nreason = "An external API requires this exact name."\n```\n\n' +
        'Write override records by hand, then run `gspot apply`. The override removes this `banned-word` finding; other names keep their checks.\n\n' +
        `To change the word limit, run:\n\n\`\`\`shell\ngspot set ${setting.name} ${String(value)} --reason "The public API uses five words."\n\`\`\`\n\n` +
        `The \`words\` finding reports identifiers over the default of ${String(setting.default)} words. The command permits ${String(value)} words.\n\n`
    );
}

/**
 * Build one settings index and a page for each large section.
 * @param data settings variants and JSON Schema from the CLI
 * @returns reference pages by path
 */
export function buildSettingsPages(data: ReturnType<typeof referenceData>): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    const sections: string[] = [];
    for (const [name, node] of listSchemaProperties(data.schema, data.schema)) {
        if (!SETTINGS_SUBPAGES.includes(name)) {
            sections.push(formatSection(name, formatSettingKeys(data.schema, name, node, data)));
            continue;
        }
        const guides: Record<string, () => string> = {
            limits: () => formatLimitsGuide(data),
            naming: () => formatNamingGuide(data),
            scope: () => formatScopeGuide(node, data),
        };
        const opening = guides[name]?.() ?? '';
        const body = opening + (name === 'scope' ? '' : formatSettingKeys(data.schema, name, node, data));
        pages.set(`gspot-toml/${name}.md`, buildReferencePage(name, `The ${name} settings of gspot.toml.`, body));
        sections.push(`- [\`${name}\`](/reference/gspot-toml/${name}/)`);
    }
    pages.set(
        'gspot-toml/index.md',
        buildReferencePage(
            'gspot.toml reference',
            'Every key, accepted value, and default of gspot.toml.',
            'Every key of `gspot.toml`, its accepted values, and its default. See [gspot.toml](/configure/gspot-toml/) to change them.\n\n' +
                `[JSON Schema](/${data.schemaFile}) for editor validation.\n\n` +
                sections.join('\n\n'),
        ),
    );
    return pages;
}
