import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { mergeValue } from '#cli/settings/inherit.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/naming.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { toolsSchema } from '#cli/schemas/settings/tools/tables.ts';
import type { Level, Configuration } from '#cli/types/manifests.ts';
import { importRulesSchema } from '#cli/schemas/settings/settings.ts';
import { getSettingType, unwrapSettingSchema } from '#cli/settings/schema/lookup.ts';
import type { Setting, AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { TABLE_KEY_SEGMENTS, SHIPPED_DEFAULT_ORIGIN } from '#cli/config/settings/inheritance.ts';
import { tableSettingSchemas, configurationTableSchemas } from '#cli/schemas/settings/tables.ts';

import {
    BUILD_SCRIPT,
    OPENNEXT_PACKAGE,
    OVERRIDING_GROUPS,
    LANGUAGE_GROUP_TABLES,
    OPENNEXT_TYPE_DEFAULTS,
} from '#cli/config/settings/settings.ts';

function addDefault(availableSettings: AvailableSettings, configuration: Configuration, setting: Setting): void {
    const previous = availableSettings.defaults.get(setting.name);
    if (availableSettings.settings.get(setting.name)?.type === 'list') {
        const value = mergeValue(setting, previous?.value, setting.default);
        availableSettings.defaults.set(setting.name, { value, configuration: configuration.name });
        return;
    }
    if (
        previous === undefined ||
        previous.configuration === configuration.name ||
        isDeepStrictEqual(previous.value, setting.default) ||
        OVERRIDING_GROUPS.has(configuration.group)
    ) {
        availableSettings.defaults.set(setting.name, { value: setting.default, configuration: configuration.name });
        return;
    }
    availableSettings.errors.push({
        key: setting.name,
        message: `The configurations ${previous.configuration} and ${configuration.name} set ${setting.name} to different values. Set it yourself in gspot.toml to decide.`,
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
    for (const setting of settings)
        if (!availableSettings.settings.has(setting.name)) availableSettings.settings.set(setting.name, setting);
    for (const setting of settings.filter((each) => each.default !== undefined))
        addDefault(availableSettings, configuration, setting);
    const languageSettings = settings.filter((setting) => setting.language_defaults !== undefined);
    for (const setting of languageSettings) {
        const [table, field] = setting.name.split('.', TABLE_KEY_SEGMENTS);
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
@param level picks the defaults of the configured level.
*/
export function buildAvailableSettings(configurations: Configuration[], level: Level): AvailableSettings {
    const availableSettings: AvailableSettings = { settings: new Map(), defaults: new Map(), errors: [] };
    for (const setting of ROOT_SETTINGS) {
        availableSettings.settings.set(setting.name, setting);
        availableSettings.defaults.set(setting.name, { value: setting.default, configuration: SHIPPED_DEFAULT_ORIGIN });
    }
    for (const [language, { categories }] of Object.entries(readNamingDefaults().languages))
        for (const [category, { cases }] of Object.entries(categories))
            availableSettings.defaults.set(`naming.${language}.${category}.cases`, {
                value: cases,
                configuration: SHIPPED_DEFAULT_ORIGIN,
            });
    for (const configuration of configurations) addConfigurationSettings(availableSettings, configuration, level);
    addToolSettings(availableSettings, configurations);
    return availableSettings;
}

function addSchemaSettings(settingsByConfiguration: Map<string, Setting[]>, schema: z.ZodType, name: string): void {
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
        const held = settingsByConfiguration.get(owner) ?? [];
        held.push(setting);
        settingsByConfiguration.set(owner, held);
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
export function mergeDetectedDefaults(
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
