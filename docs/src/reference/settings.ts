import { isDeepStrictEqual } from 'node:util';
import type { JSONSchema } from 'zod/v4/core';
import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
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
    if (node.anyOf !== undefined) {
        const branches = node.anyOf.map((entry) => getSchemaNode(schema, entry));
        // Values that each carry their own meaning read better as a list than as one long sentence.
        if (branches.every((branch) => branch.const !== undefined && branch.description !== undefined)) {
            const items = branches.map((branch) => '- ' + formatAcceptedValue(schema, branch));
            return `One of these values:\n\n${items.join('\n')}\n\n`;
        }
        return [...new Set(node.anyOf.map((entry) => formatAcceptedValue(schema, entry)))].join(' or ');
    }
    const labels: Readonly<Record<string, string>> = SCHEMA_TYPE_LABELS;
    return [node.type ?? 'Value']
        .flat()
        .map((type) => labels[type] ?? type)
        .join(' or ');
}

// The keys under a table or a record: its fixed keys, then the keys of each map entry under a <name> placeholder.
function listSchemaProperties(
    schema: JSONSchema.JSONSchema,
    value: JSONSchema.JSONSchema | boolean,
): Array<{ name: string; node: JSONSchema.JSONSchema; required: boolean }> {
    const node = getSchemaNode(schema, value);
    const shape =
        typeof node.items === 'object' && !Array.isArray(node.items) ? getSchemaNode(schema, node.items) : node;
    const required = new Set(shape.required);
    const fixed =
        shape.properties === undefined
            ? []
            : Object.entries(shape.properties).map(([name, child]) => ({
                  name,
                  node: getSchemaNode(schema, child),
                  required: required.has(name),
              }));
    const map =
        typeof shape.additionalProperties === 'object' ? getSchemaNode(schema, shape.additionalProperties) : undefined;
    return map?.properties === undefined ? fixed : [...fixed, { name: '<name>', node: map, required: false }];
}

// The declared variants of a setting; a language key without its own declaration takes the language default.
function listSettingVariants(
    name: string,
    data: ReturnType<typeof readReferenceData>,
): ReturnType<typeof readReferenceData>['settings'] {
    const language = LANGUAGE_SETTING.exec(name)?.groups?.['language'];
    const declared = data.settings.filter(({ setting }) => setting.name === name);
    if (declared.length > 0 || language === undefined) return declared;
    return data.settings
        .filter(({ setting }) => setting.name === name.replace(LANGUAGE_SETTING, '$1.$3'))
        .map(({ setting, owners }) => ({
            setting: { ...setting, default: setting.language_defaults?.[language] ?? setting.default },
            owners,
        }));
}

function formatDefaults(variants: ReturnType<typeof readReferenceData>['settings']): string {
    return variants
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
}

function formatSetting(
    schema: JSONSchema.JSONSchema,
    name: string,
    value: JSONSchema.JSONSchema | boolean,
    data: ReturnType<typeof readReferenceData>,
    required = false,
): [string, string] {
    const variants = listSettingVariants(name, data);
    const node = getSchemaNode(schema, value);
    const reasons = [
        ...new Set(
            variants.flatMap(({ setting }) => (setting.reason_needed === undefined ? [] : [setting.reason_needed])),
        ),
    ];
    const accepted = formatAcceptedValue(schema, value);
    const sentence = /[.\n]$/u.test(accepted) ? accepted : accepted + '.';
    // A record field without a declared default takes the default of its schema.
    const schemaDefault = node.default === undefined ? 'unset' : `\`${JSON.stringify(node.default)}\``;
    const presence = required ? 'Required.' : `Default: ${formatDefaults(variants) || schemaDefault}.`;
    return [
        `\`${name}\``,
        `${sentence} ${presence}` +
            (reasons.length === 0 ? '' : ` Reason needed when: ${reasons.join(', ')}.`) +
            (node.description === undefined ? '' : ` ${escapeCell(node.description)}`),
    ];
}

function formatSettingKeys(
    schema: JSONSchema.JSONSchema,
    prefix: string,
    value: JSONSchema.JSONSchema | boolean,
    data: ReturnType<typeof readReferenceData>,
): string {
    const rows: [string, string][] = [];
    function collect(name: string, node: JSONSchema.JSONSchema | boolean, required: boolean): void {
        const children = listSchemaProperties(schema, node);
        if (children.length === 0) rows.push(formatSetting(schema, name, node, data, required));
        else
            for (const child of children)
                collect(name === '' ? child.name : `${name}.${child.name}`, child.node, child.required);
    }
    collect(prefix, value, false);
    return formatDefinitions(rows);
}

function formatLimitsGuide(data: ReturnType<typeof readReferenceData>): string {
    const { setting } = data.settings.find(
        ({ setting }) => setting.name.startsWith('limits.') && setting.reason_needed === 'raising',
    ) as ReturnType<typeof readReferenceData>['settings'][number];
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

function formatScopeGuide(node: JSONSchema.JSONSchema | boolean, data: ReturnType<typeof readReferenceData>): string {
    const properties = listSchemaProperties(data.schema, node);
    return (
        'A scope selects settings for a folder. See [Monorepos and scopes](/configure/monorepos/) for inheritance.\n\n' +
        formatDefinitions(
            properties
                .filter((property) => property.name === 'path')
                .map((property) => formatSetting(data.schema, 'scope.path', property.node, data, property.required)),
        ) +
        '\n\nAccepted root sections:\n\n' +
        properties
            .filter((property) => property.name !== 'path')
            .map(
                ({ name: key }) =>
                    `- [\`${key}\`](/reference/gspot-toml/${SETTINGS_SUBPAGES.includes(key) ? key + '/' : '#' + key})`,
            )
            .join('\n')
    );
}

function formatNamingGuide(data: ReturnType<typeof readReferenceData>): string {
    const { setting } = data.settings.find(({ setting }) => setting.name === 'naming.max_words') as ReturnType<
        typeof readReferenceData
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
export function buildSettingsPages(data: ReturnType<typeof readReferenceData>): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>();
    const sections: string[] = [];
    for (const { name, node } of listSchemaProperties(data.schema, data.schema)) {
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
                `The [JSON Schema](/${data.schemaFile}) describes every key. Editors apply it on their own once SchemaStore lists gspot.\n\n` +
                sections.join('\n\n'),
        ),
    );
    return pages;
}
