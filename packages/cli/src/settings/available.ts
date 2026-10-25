import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { mergeValue } from '#cli/settings/inherit.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/naming.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import { unwrapSettingSchema } from '#cli/schemas/settings/fields.ts';
import { LANGUAGE_GROUP_TABLES } from '#cli/config/settings/inherit.ts';
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
    LANGUAGE_SETTING_FIELDS,
} from '#cli/config/settings/available.ts';

function getSchemaPathRole(schema: z.core.JSONSchema.JSONSchema): unknown {
    if (schema['path_role'] !== undefined) return schema['path_role'];
    return typeof schema.items === 'object' && !Array.isArray(schema.items) ? schema.items['path_role'] : undefined;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function isScalarConflict(previous: SettingDefault, configuration: Configuration, setting: Setting): boolean {
    return (
        previous.configuration !== configuration.name &&
        !isDeepStrictEqual(previous.value, setting.default) &&
        !OVERRIDING_GROUPS.has(configuration.group)
    );
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
    const settings = (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).map((listed) =>
        isAll && listed.default_all !== undefined ? { ...listed, default: listed.default_all } : listed,
    );
    for (const setting of settings) {
        if (!availableSettings.settings.has(setting.name)) availableSettings.settings.set(setting.name, setting);
        addDefault(availableSettings, configuration, setting);
    }
    const languageSettings = settings.filter((setting) => setting.language_defaults !== undefined);
    for (const setting of languageSettings) {
        const [table, field] = setting.name.split('.', LANGUAGE_SETTING_FIELDS);
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
        type: pathRole !== undefined && input.type === 'string' ? 'path' : convertSchemaType(input.type),
        ...(allowedRole !== undefined && { path_role: allowedRole }),
    };
}

const ROOT_SETTINGS: Setting[] = Object.entries({ ...rootSettingSchemas, ...tableSettingSchemas }).map<Setting>(
    ([name, schema]) => {
        const value = schema.parse(undefined);
        return {
            name,
            ...getSettingType(schema),
            default: value,
            ...schema.meta(),
            description: schema.description ?? '',
        };
    },
);

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

function addToolSettings(availableSettings: AvailableSettings, configurations: Configuration[]): void {
    const tools = new Set(configurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    for (const [tool, settings] of TOOL_SETTINGS) {
        if (!tools.has(tool)) continue;
        for (const setting of settings)
            if (!availableSettings.settings.has(setting.name)) availableSettings.settings.set(setting.name, setting);
    }
}

/**
Build the known settings in the order of the selected configurations. Framework, platform, library, and database
configurations override single-value defaults.

@param configurations the manifests of the selection, in order.
@param level picks the recommended or all defaults.
@returns the settings, their defaults, and the conflicts found on the way.
*/
export function buildAvailableSettings(configurations: Configuration[], level: Level): AvailableSettings {
    const availableSettings: AvailableSettings = { settings: new Map(), defaults: new Map(), errors: [] };
    for (const setting of ROOT_SETTINGS) {
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
    addToolSettings(availableSettings, configurations);
    return availableSettings;
}

function addSchemaSettings(settings: Map<string, Setting[]>, schema: z.ZodType, name: string): void {
    const definition = schema.meta();
    const owners = definition?.['configurations'] as readonly string[] | undefined;
    if (owners === undefined) return;
    const setting: Setting = {
        name,
        ...getSettingType(schema),
        default: schema.parse(undefined),
        ...definition,
        description: schema.description ?? '',
    };
    for (const owner of owners) {
        const held = settings.get(owner) ?? [];
        held.push(setting);
        settings.set(owner, held);
    }
}

function buildSettingsByConfiguration(): Map<string, Setting[]> {
    const settings = new Map<string, Setting[]>();
    function addSettings(schema: z.ZodType, name: string): void {
        if (
            [...LANGUAGE_GROUP_TABLES].some((group) =>
                SETTING_LANGUAGES.some((language) => name === `${group}.${language}`),
            )
        )
            return;
        addSchemaSettings(settings, schema, name);
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

export const SETTINGS_BY_CONFIGURATION = buildSettingsByConfiguration();

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
