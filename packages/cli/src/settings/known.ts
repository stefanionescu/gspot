import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { mergeValue } from '#cli/settings/inherit.ts';
import { PATH_ROLES } from '#cli/config/settings/schema.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { unwrapSettingSchema } from '#cli/schemas/settings/parts.ts';
import { OVERRIDING_GROUPS } from '#cli/config/settings/inheritance.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/gspot-toml.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { BUILD_SCRIPT, OPENNEXT_PACKAGE, OPENNEXT_TYPE_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { type Setting, type KnownSettings, type SettingDefault } from '#cli/types/settings/inheritance.ts';

function getSchemaPathRole(schema: z.core.JSONSchema.JSONSchema): unknown {
    if (schema['path_role'] !== undefined) return schema['path_role'];
    if (typeof schema.items === 'object' && !Array.isArray(schema.items)) return schema.items['path_role'];
    return undefined;
}

function isScalarConflict(previous: SettingDefault, configuration: Configuration, setting: Setting): boolean {
    if (previous.configuration === configuration.name) return false;
    if (isDeepStrictEqual(previous.value, setting.default)) return false;
    return !OVERRIDING_GROUPS.has(configuration.group);
}

function addDefault(known: KnownSettings, configuration: Configuration, setting: Setting): void {
    if (setting.default === undefined) return;
    const previous = known.defaults.get(setting.name);
    const isList = known.settings.get(setting.name)?.type === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, configuration, setting)) {
        known.errors.push({
            key: setting.name,
            message: `The configurations \`${previous.configuration}\` and \`${configuration.name}\` set \`${setting.name}\` to different values. Set it yourself in gspot.toml to decide.`,
        });
        return;
    }
    known.defaults.set(setting.name, {
        value: isList ? mergeValue(setting, previous?.value, setting.default) : setting.default,
        configuration: configuration.name,
    });
}

// Add the settings of one configuration and their defaults, then its [defaults] for settings that other configurations
// declare. Those apply only while the selection includes that configuration.
function addConfigurationSettings(known: KnownSettings, configuration: Configuration, level: Level): void {
    const isAll = level === 'all';
    const settings = listSettings(configuration.name).map((declared) =>
        isAll && declared.default_all !== undefined ? { ...declared, default: declared.default_all } : declared,
    );
    for (const setting of settings) {
        if (!known.settings.has(setting.name)) known.settings.set(setting.name, setting);
        addDefault(known, configuration, setting);
    }
    for (const setting of settings.filter((entry) => entry.language_defaults !== undefined)) {
        const [table, field] = setting.name.split('.');
        const languageDefaults = setting.language_defaults as NonNullable<Setting['language_defaults']>;
        for (const [language, value] of Object.entries(languageDefaults))
            known.defaults.set(`${table as string}.${language}.${field as string}`, {
                value,
                configuration: configuration.name,
            });
    }
    const overrides = Object.entries(configuration.defaults)
        .map(([name, value]) => ({ setting: known.settings.get(name), value }))
        .filter((entry): entry is typeof entry & { setting: Setting } => entry.setting !== undefined);
    for (const { setting, value } of overrides) addDefault(known, configuration, { ...setting, default: value });
}

// The command value kind comes from the same input schema that accepts it.
function convertSchemaType(type: z.core.JSONSchema.JSONSchema['type']): Setting['type'] {
    if (type === 'array') return 'list';
    if (type === 'object') return 'table';
    if (['number', 'integer'].includes(type as string)) return 'number';
    if (type === 'string' || type === 'boolean') return type;
    throw new Error(`The setting schema has no supported value type: ${String(type)}.`);
}

function getSettingType(schema: z.ZodType): Pick<Setting, 'type' | 'path_role'> {
    const document = z.toJSONSchema(schema, { io: 'input' });
    const input = document.anyOf?.find((value) => typeof value === 'object' && value.type !== undefined) ?? document;
    const pathRole = getSchemaPathRole(input);
    const allowedRole = PATH_ROLES.find((role) => role === pathRole);
    return {
        type: input.type === 'string' && pathRole !== undefined ? 'path' : convertSchemaType(input.type),
        ...(allowedRole === undefined ? {} : { path_role: allowedRole }),
    };
}

const ROOT_SETTINGS: Setting[] = [
    ...Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).map<Setting>(([name, schema]) => {
        const value = schema.parse(undefined);
        return {
            name,
            ...getSettingType(schema),
            default: value,
            ...schema.meta(),
            description: schema.description ?? '',
        };
    }),
];

const TOOL_SETTINGS: Map<string, Setting[]> = new Map(
    Object.entries(toolsSchema.shape).map(([tool, table]) => [
        tool,
        Object.entries<z.ZodType>(table.unwrap().shape).map<Setting>(([field, schema]) => ({
            name: `tools.${tool}.${field}`,
            ...getSettingType(schema),
            ...schema.meta(),
            description: schema.description ?? '',
        })),
    ]),
);

/**
 * Build the known settings in selection order. Framework, platform, library, and database configurations override
 * single-value defaults.
 *
 * @param selected the manifests of the selection, in order.
 * @param level picks the recommended or all defaults.
 * @returns the declarations, their defaults, and the conflicts found on the way.
 */
export function buildKnownSettings(selected: Configuration[], level: Level): KnownSettings {
    const roots = ROOT_SETTINGS;
    const settingsByTool = TOOL_SETTINGS;

    const known: KnownSettings = { settings: new Map(), defaults: new Map(), errors: [] };
    for (const setting of roots) {
        known.settings.set(setting.name, setting);
        known.defaults.set(setting.name, { value: setting.default, configuration: 'gspot default' });
    }
    for (const [language, { categories }] of Object.entries(readNamingDefaults().languages))
        for (const [category, { cases }] of Object.entries(categories))
            known.defaults.set(`naming.${language}.${category}.cases`, {
                value: cases,
                configuration: 'gspot default',
            });
    for (const configuration of selected) addConfigurationSettings(known, configuration, level);
    const tools = new Set(selected.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    for (const [, settings] of [...settingsByTool].filter(([tool]) => tools.has(tool))) {
        for (const setting of settings.filter((entry) => !known.settings.has(entry.name)))
            known.settings.set(setting.name, setting);
    }
    return known;
}

/**
 * Read the declarations and defaults from their field schemas.
 *
 * @param configuration the name whose fields to read.
 * @returns the settings of this configuration.
 */
export function listSettings(configuration: string): Setting[] {
    const settings: Setting[] = [];
    const visited = new Set<z.ZodType>();
    function addSettings(schema: z.ZodType, name: string): void {
        if (visited.has(schema)) return;
        visited.add(schema);
        const facts = schema.meta();
        const owners = facts?.['configurations'];
        if (Array.isArray(owners) && owners.includes(configuration)) {
            settings.push({
                name,
                ...getSettingType(schema),
                default: schema.parse(undefined),
                ...facts,
                description: schema.description ?? '',
            });
        }
        const inner = unwrapSettingSchema(schema);
        if (inner instanceof z.ZodObject)
            for (const [field, child] of Object.entries(inner.shape))
                addSettings(child as z.ZodType, `${name}.${field}`);
    }
    for (const [name, schema] of Object.entries(configurationTableSchemas)) addSettings(schema, name);
    addSettings(importRulesSchema, 'import_rule');
    for (const [tool, schema] of Object.entries(toolsSchema.shape)) addSettings(schema, `tools.${tool}`);
    return settings;
}

/**
 * Apply defaults detected from the package manager and project dependencies.
 *
 * @param known the mutable defaults of the selected configurations.
 * @param detected the package manager and dependency names of the scope.
 * @param detected.packageManagerName the package manager when the scope holds a site build default.
 * @param detected.dependencyNames the package names recorded in the scope.
 */
export function applyDetectedDefaults(
    known: KnownSettings,
    detected: { packageManagerName: string | undefined; dependencyNames: string[] },
): void {
    const build = known.defaults.get('site.build_command');
    if (build !== undefined && detected.packageManagerName !== undefined)
        known.defaults.set('site.build_command', { ...build, value: [detected.packageManagerName, ...BUILD_SCRIPT] });
    if (detected.dependencyNames.includes(OPENNEXT_PACKAGE)) {
        for (const [name, value] of Object.entries(OPENNEXT_TYPE_DEFAULTS)) {
            const held = known.defaults.get(name);
            if (held !== undefined) known.defaults.set(name, { ...held, value });
        }
    }
}
