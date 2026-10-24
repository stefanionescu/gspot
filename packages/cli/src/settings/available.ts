import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { mergeValue } from '#cli/settings/inherit.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { unwrapSettingSchema } from '#cli/schemas/settings/fields.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { importRulesSchema } from '#cli/schemas/settings/import-rules.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/schemas/settings/tables.ts';
import { type Setting, type SettingDefault, type AvailableSettings } from '#cli/types/settings/inheritance.ts';

import {
    PATH_ROLES,
    BUILD_SCRIPT,
    OPENNEXT_PACKAGE,
    OVERRIDING_GROUPS,
    OPENNEXT_TYPE_DEFAULTS,
} from '#cli/config/settings/available.ts';

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

function addDefault(availableSettings: AvailableSettings, configuration: Configuration, setting: Setting): void {
    if (setting.default === undefined) return;
    const previous = availableSettings.defaults.get(setting.name);
    const isList = availableSettings.settings.get(setting.name)?.type === 'list';
    if (!isList && previous !== undefined && isScalarConflict(previous, configuration, setting)) {
        availableSettings.errors.push({
            key: setting.name,
            message: `The configurations ${previous.configuration} and ${configuration.name} set ${setting.name} to different values. Set it yourself in gspot.toml to decide.`,
        });
        return;
    }
    availableSettings.defaults.set(setting.name, {
        value: isList ? mergeValue(setting, previous?.value, setting.default) : setting.default,
        configuration: configuration.name,
    });
}

function addConfigurationSettings(
    availableSettings: AvailableSettings,
    configuration: Configuration,
    level: Level,
): void {
    const isAll = level === 'all';
    const settings = listSettings(configuration.name).map((listed) =>
        isAll && listed.default_all !== undefined ? { ...listed, default: listed.default_all } : listed,
    );
    for (const setting of settings) {
        if (!availableSettings.settings.has(setting.name)) availableSettings.settings.set(setting.name, setting);
        addDefault(availableSettings, configuration, setting);
    }
    for (const setting of settings.filter((each) => each.language_defaults !== undefined)) {
        const [table, field] = setting.name.split('.');
        const languageDefaults = setting.language_defaults as NonNullable<Setting['language_defaults']>;
        for (const [language, value] of Object.entries(languageDefaults))
            availableSettings.defaults.set(`${table as string}.${language}.${field as string}`, {
                value,
                configuration: configuration.name,
            });
    }
    const overrides = Object.entries(configuration.defaults)
        .map(([name, value]) => ({ setting: availableSettings.settings.get(name), value }))
        .filter((override): override is typeof override & { setting: Setting } => override.setting !== undefined);
    for (const { setting, value } of overrides)
        addDefault(availableSettings, configuration, { ...setting, default: value });
}

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
Build the known settings in the order of the selected configurations. Framework, platform, library, and database
configurations override single-value defaults.

@param configurations the manifests of the selection, in order.
@param level picks the recommended or all defaults.
@returns the settings, their defaults, and the conflicts found on the way.
*/
export function buildAvailableSettings(configurations: Configuration[], level: Level): AvailableSettings {
    const roots = ROOT_SETTINGS;
    const settingsByTool = TOOL_SETTINGS;

    const availableSettings: AvailableSettings = { settings: new Map(), defaults: new Map(), errors: [] };
    for (const setting of roots) {
        availableSettings.settings.set(setting.name, setting);
        availableSettings.defaults.set(setting.name, { value: setting.default, configuration: 'gspot default' });
    }
    for (const [language, { categories }] of Object.entries(readNamingDefaults().languages))
        for (const [category, { cases }] of Object.entries(categories))
            availableSettings.defaults.set(`naming.${language}.${category}.cases`, {
                value: cases,
                configuration: 'gspot default',
            });
    for (const configuration of configurations) addConfigurationSettings(availableSettings, configuration, level);
    const tools = new Set(configurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    for (const [, settings] of [...settingsByTool].filter(([tool]) => tools.has(tool))) {
        for (const setting of settings.filter((each) => !availableSettings.settings.has(each.name)))
            availableSettings.settings.set(setting.name, setting);
    }
    return availableSettings;
}

/**
List the settings that one configuration declares, with their defaults, from the definitions in the settings schemas.

@param configuration the configuration name.
@returns the settings of this configuration.
*/
export function listSettings(configuration: string): Setting[] {
    const settings: Setting[] = [];
    const visited = new Set<z.ZodType>();
    function addSettings(schema: z.ZodType, name: string): void {
        if (visited.has(schema)) return;
        visited.add(schema);
        const definition = schema.meta();
        const owners = definition?.['configurations'];
        if (Array.isArray(owners) && owners.includes(configuration)) {
            settings.push({
                name,
                ...getSettingType(schema),
                default: schema.parse(undefined),
                ...definition,
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
Apply defaults detected from the package manager and project dependencies.

@param availableSettings the mutable defaults of the selected configurations.
@param detected the package manager and dependency names of the scope.
@param detected.packageManagerName the package manager when the scope holds a site build default.
@param detected.dependencyNames the package names recorded in the scope.
*/
export function applyDetectedDefaults(
    availableSettings: AvailableSettings,
    detected: { packageManagerName: string | undefined; dependencyNames: string[] },
): void {
    const build = availableSettings.defaults.get('site.build_command');
    if (build !== undefined && detected.packageManagerName !== undefined)
        availableSettings.defaults.set('site.build_command', {
            ...build,
            value: [detected.packageManagerName, ...BUILD_SCRIPT],
        });
    if (detected.dependencyNames.includes(OPENNEXT_PACKAGE)) {
        for (const [name, value] of Object.entries(OPENNEXT_TYPE_DEFAULTS)) {
            const held = availableSettings.defaults.get(name);
            if (held !== undefined) availableSettings.defaults.set(name, { ...held, value });
        }
    }
}
