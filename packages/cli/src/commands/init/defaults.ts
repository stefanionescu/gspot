import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { buildSettings } from '#cli/settings/read.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { WrittenTable } from '#cli/types/commands/init.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import type { Settings, TomlTable } from '#cli/types/settings/file.ts';
import { findSetting, getSettingValue } from '#cli/settings/inherit.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { DETECTED_SETTINGS } from '#cli/config/commands/init/defaults.ts';

function isInheritedValueChanged(
    name: string,
    key: string,
    segments: string[],
    writtenTable: WrittenTable,
    tables: WrittenTable[],
    settings: Settings,
): boolean {
    const consumers = tables.filter(({ scope }) => isInScope(scope, writtenTable.scope));
    const omitted = structuredClone(writtenTable.table);
    Reflect.deleteProperty(getValueAt(omitted, segments.slice(0, -1)) as TomlTable, name);
    const changed = { ...settings };
    if (writtenTable.scope === '') changed.written = omitted;
    else {
        const previous = settings.scopes.get(writtenTable.scope) as NonNullable<ReturnType<Settings['scopes']['get']>>;
        changed.scopes = new Map(settings.scopes);
        changed.scopes.set(writtenTable.scope, { ...previous, written: omitted });
    }
    return consumers.some(
        (consumer) =>
            !isDeepStrictEqual(
                getSettingValue(consumer.availableSettings, settings, key, consumer.scope)?.value,
                getSettingValue(consumer.availableSettings, changed, key, consumer.scope)?.value,
            ),
    );
}

function stripTableDefaults(
    table: TomlTable,
    writtenTable: WrittenTable,
    tables: WrittenTable[],
    settings: Settings,
    path: string[] = [],
): TomlTable {
    const fields = Object.entries(table).map(([name, value]) => {
        const segments = [...path, name];
        const key = segments.join('.');
        return { name, value, segments, key, setting: findSetting(writtenTable.availableSettings, key)?.setting };
    });
    const settingFields = new Map(
        fields
            .filter(({ setting }) => setting !== undefined)
            .flatMap(({ name, value, key, segments }) => {
                return isInheritedValueChanged(name, key, segments, writtenTable, tables, settings)
                    ? [[name, value]]
                    : [];
            }),
    );
    const rootFields = new Map<string, z.ZodType>(path.length === 0 ? Object.entries(settingsSchema.shape) : []);
    const remaining = new Map(
        fields
            .filter(({ setting }) => setting === undefined)
            .flatMap(({ name, value, segments }) => {
                const defaultValue = rootFields.get(name)?.safeParse(undefined);
                if (defaultValue?.success === true && isDeepStrictEqual(value, defaultValue.data)) return [];
                return [
                    [
                        name,
                        isTable(value) ? stripTableDefaults(value, writtenTable, tables, settings, segments) : value,
                    ],
                ];
            }),
    );
    const kept = new Map([...settingFields, ...remaining]);
    const pairs = Object.keys(table)
        .filter((name) => kept.has(name))
        .map((name) => [name, kept.get(name)] as const);
    return Object.fromEntries(
        pairs.filter(
            ([name, value]) =>
                !isTable(value) ||
                Object.keys(value).length > 0 ||
                (isTable(table[name]) && Object.keys(table[name]).length === 0),
        ),
    );
}

/**
Drop written values that equal the default, but keep a scope override of its parent.

@param settings the ordered draft, whose settings give the defaults.
@returns the draft without values that equal the default.
*/
export function stripDefaults(settings: TomlTable): TomlTable {
    const configurationsByName = readConfigurations();
    const allSettings = buildSettings(settingsSchema.parse(settings), settings);
    const level = settingsSchema.shape.level.parse(settings['level']);
    const scopes = ((settings['scope'] ?? []) as TomlTable[]).map((table) => ({
        path: stripTrailingSlashes(table['path'] as string),
        table,
    }));
    const selected = {
        configurations: settingsSchema.shape.configurations.parse(settings['configurations']),
        removed_configurations: settingsSchema.shape.removed_configurations.parse(settings['removed_configurations']),
        scopes: new Map(
            scopes.map(({ path, table }) => [
                path,
                {
                    configurations: settingsSchema.shape.configurations.parse(table['configurations']),
                    removed_configurations: settingsSchema.shape.removed_configurations.parse(
                        table['removed_configurations'],
                    ),
                },
            ]),
        ),
    };
    const root = {
        scope: '',
        table: settings,
        availableSettings: buildAvailableSettings(selectForScope(selected, '', configurationsByName), level),
    };
    const tables = [
        root,
        ...scopes.map<WrittenTable>(({ path, table }) => ({
            scope: path,
            table,
            availableSettings: buildAvailableSettings(selectForScope(selected, path, configurationsByName), level),
        })),
    ].toSorted((left, right) => compareScopeDepth(left.scope, right.scope));
    for (const key of DETECTED_SETTINGS) for (const table of tables) table.availableSettings.defaults.delete(key);
    const scopeValues = scopes.map(({ path }) => {
        const writtenTable = tables.find((each) => each.scope === path) as WrittenTable;
        return stripTableDefaults(writtenTable.table, writtenTable, tables, allSettings);
    });
    const rootValues = stripTableDefaults(settings, root, tables, allSettings);
    return scopes.length > 0 ? { ...rootValues, scope: scopeValues } : rootValues;
}
