import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { TomlTable } from '#cli/types/settings.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildSettingsFromTable } from '#cli/settings/parse.ts';
import { DETECTED_SETTINGS } from '#cli/config/generation/setup.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { isTable, findValueAt, getRequired } from '#cli/system/tables.ts';
import type { WrittenTable, WrittenTables } from '#cli/types/generation.ts';
import { findSetting, getSettingValue } from '#cli/settings/values/inherit.ts';

function isInheritedValueChanged(
    { name, key, segments }: { name: string; key: string; segments: string[] },
    { writtenTable, tables, settings }: WrittenTables,
): boolean {
    const consumers = tables.filter(({ scopePath }) => isInScope(scopePath, writtenTable.scopePath));
    const omitted = structuredClone(writtenTable.table);
    Reflect.deleteProperty(findValueAt(omitted, segments.slice(0, -1)) as TomlTable, name);
    const changed = { ...settings };
    if (writtenTable.scopePath === '') changed.written = omitted;
    else {
        const previous = getRequired(settings.scopes, writtenTable.scopePath, 'scope settings');
        changed.scopes = new Map(settings.scopes);
        changed.scopes.set(writtenTable.scopePath, { ...previous, written: omitted });
    }
    return consumers.some(
        (consumer) =>
            !isDeepStrictEqual(
                getSettingValue(consumer.availableSettings, settings, key, consumer.scopePath)?.value,
                getSettingValue(consumer.availableSettings, changed, key, consumer.scopePath)?.value,
            ),
    );
}

function stripTableDefaults(table: TomlTable, written: WrittenTables, path: string[] = []): TomlTable {
    const { writtenTable } = written;
    const fields = Object.entries(table).map(([name, value]) => {
        const segments = [...path, name];
        const key = segments.join('.');
        return { name, value, segments, key, setting: findSetting(writtenTable.availableSettings, key)?.setting };
    });
    const settingFields = new Map(
        fields
            .filter(({ setting }) => setting !== undefined)
            .flatMap(({ name, value, key, segments }) =>
                isInheritedValueChanged({ name, key, segments }, written) ? [[name, value]] : [],
            ),
    );
    const rootFields = new Map<string, z.ZodType>(path.length === 0 ? Object.entries(settingsSchema.shape) : []);
    const remaining = new Map(
        fields
            .filter(({ setting }) => setting === undefined)
            .flatMap(({ name, value, segments }) => {
                const defaultValue = rootFields.get(name)?.safeParse(undefined);
                if (defaultValue?.success === true && isDeepStrictEqual(value, defaultValue.data)) return [];
                return [[name, isTable(value) ? stripTableDefaults(value, written, segments) : value]];
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

export function stripDefaults(settings: TomlTable): TomlTable {
    const allSettings = buildSettingsFromTable(settings);
    const { level } = allSettings;
    const scopes = ((settings['scope'] ?? []) as TomlTable[]).map((table) => ({
        path: stripTrailingSlashes(table['path'] as string),
        table,
    }));
    const root = {
        scopePath: '',
        table: settings,
        availableSettings: buildAvailableSettings(selectConfigurationsForScope(allSettings, ''), level),
    };
    const scopeTables = scopes.map<WrittenTable>(({ path, table }) => ({
        scopePath: path,
        table,
        availableSettings: buildAvailableSettings(selectConfigurationsForScope(allSettings, path), level),
    }));
    const tables = [root, ...scopeTables].toSorted((left, right) => compareScopeDepth(left.scopePath, right.scopePath));
    for (const key of DETECTED_SETTINGS) for (const table of tables) table.availableSettings.defaults.delete(key);
    const scopeValues = scopeTables.map((writtenTable) =>
        stripTableDefaults(writtenTable.table, { writtenTable, tables, settings: allSettings }),
    );
    const rootValues = stripTableDefaults(settings, { writtenTable: root, tables, settings: allSettings });
    return scopes.length > 0 ? { ...rootValues, scope: scopeValues } : rootValues;
}
