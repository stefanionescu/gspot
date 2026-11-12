import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

import { BOUND_PREFIXES, SETTING_LANGUAGES } from '#cli/config/manifests.ts';
import { LANGUAGE_GROUP_TABLES, SHIPPED_DEFAULT_ORIGIN, TABLE_KEY_SEGMENTS } from '#cli/config/settings/schema.ts';
import { OVERRIDING_GROUPS } from '#cli/config/settings/validation.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { configurationTableSchemas, tableSettingSchemas } from '#cli/schemas/settings/configurations.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { importRulesSchema } from '#cli/schemas/settings/tables.ts';
import { toolsSchema } from '#cli/schemas/settings/tools.ts';
import { mergeValue } from '#cli/settings/inherit.ts';
import { getSettingType, unwrapSettingSchema } from '#cli/settings/lookup.ts';
import type { Configuration, Setting } from '#cli/types/manifests.ts';
import type { AvailableSettings, Level } from '#cli/types/settings.ts';

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

function addLanguageDefaults(
    availableSettings: AvailableSettings,
    configuration: Configuration,
    settings: Setting[],
): void {
    for (const setting of settings) {
        if (setting.language_defaults === undefined) continue;
        const [table, field] = setting.name.split('.', TABLE_KEY_SEGMENTS);
        for (const [language, value] of Object.entries(setting.language_defaults))
            availableSettings.defaults.set(`${table as string}.${language}.${field as string}`, {
                value,
                configuration: configuration.name,
            });
    }
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
        if (setting.default !== undefined) addDefault(availableSettings, configuration, setting);
    }
    addLanguageDefaults(availableSettings, configuration, settings);
    const overrides = Object.entries(configuration.defaults)
        .map(([name, value]) => ({ setting: availableSettings.settings.get(name), value }))
        .filter((override): override is typeof override & { setting: Setting } => override.setting !== undefined);
    for (const { setting, value } of overrides)
        addDefault(availableSettings, configuration, { ...setting, default: value });
}

function getBoundReason(name: string, definition: z.GlobalMeta | undefined): Pick<Setting, 'reason_for'> | undefined {
    if (definition?.reasoned !== true) return undefined;
    const field = name.slice(name.lastIndexOf('.') + 1);
    const direction = Object.entries(BOUND_PREFIXES).find(([prefix]) => field.startsWith(prefix))?.[1];
    return direction === undefined ? undefined : { reason_for: direction };
}

function buildSetting(name: string, schema: z.ZodType): Setting {
    const definition = schema.meta();
    return {
        name,
        ...getSettingType(schema),
        default: schema.parse(undefined),
        ...getBoundReason(name, definition),
        ...definition,
        description: schema.description ?? '',
    };
}

export const ROOT_SETTINGS: Setting[] = Object.entries<z.ZodType>({
    ...rootSettingSchemas,
    ...tableSettingSchemas,
}).map(([name, schema]) => buildSetting(name, schema));

function addSchemaSettings(settingsByConfiguration: Map<string, Setting[]>, schema: z.ZodType, name: string): void {
    const owners = schema.meta()?.configurations;
    if (owners === undefined) return;
    const setting = buildSetting(name, schema);
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
    return availableSettings;
}

export const SETTINGS_BY_CONFIGURATION = buildSettingsByConfiguration();
