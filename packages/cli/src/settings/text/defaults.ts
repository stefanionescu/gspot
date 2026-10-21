import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { buildSettings } from '#cli/settings/read.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/settings/scope-view.ts';
import { isRecord, getValueAt } from '#cli/system/tables.ts';
import { type WrittenTable } from '#cli/types/settings/text.ts';
import { DETECTED_SETTINGS } from '#cli/config/settings/defaults.ts';
import { settingsSchema } from '#cli/schemas/settings/gspot-toml.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { findSetting, getSettingValue } from '#cli/settings/inherit.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { type Settings, type TomlTable } from '#cli/types/settings/file.ts';

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
        const previous = settings.scopes[writtenTable.scope] as Settings['scopes'][string];
        changed.scopes = { ...settings.scopes, [writtenTable.scope]: { ...previous, written: omitted } };
    }
    return !consumers.every((consumer) =>
        isDeepStrictEqual(
            getSettingValue(consumer.known, settings, key, consumer.scope)?.value,
            getSettingValue(consumer.known, changed, key, consumer.scope)?.value,
        ),
    );
}

function parseConfigurationSelection(table: TomlTable) {
    return {
        configurations: settingsSchema.shape.configurations.parse(table['configurations']),
        removed_configurations: settingsSchema.shape.removed_configurations.parse(table['removed_configurations']),
    };
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
        return { name, value, segments, key, setting: findSetting(writtenTable.known, key)?.setting };
    });
    const declared = new Map(
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
                        isRecord(value) ? stripTableDefaults(value, writtenTable, tables, settings, segments) : value,
                    ],
                ];
            }),
    );
    const kept = new Map([...declared, ...remaining]);
    const entries = Object.keys(table)
        .filter((name) => kept.has(name))
        .map((name) => [name, kept.get(name)] as const);
    return Object.fromEntries(
        entries.filter(
            ([name, value]) =>
                !isRecord(value) ||
                Object.keys(value).length > 0 ||
                (isRecord(table[name]) && Object.keys(table[name]).length === 0),
        ),
    );
}

/**
 * Drop written values that equal the default, but keep a scope override of its parent.
 *
 * @param settings the ordered draft, whose settings give the defaults.
 * @returns the draft without values that equal the default.
 */
export function stripDefaults(settings: TomlTable): TomlTable {
    const configurations = readConfigurations();
    const parsed = settingsSchema.parse(settings);
    const effectiveSettings = buildSettings(parsed, settings);
    const level = settingsSchema.shape.level.parse(settings['level']);
    const scopes = (settings['scope'] ?? []) as TomlTable[];
    const selection = {
        ...parseConfigurationSelection(settings),
        scopes: Object.fromEntries(
            scopes.map((table) => [trimTrailingSlashes(table['path'] as string), parseConfigurationSelection(table)]),
        ),
    };
    const root = {
        scope: '',
        table: settings,
        known: buildKnownSettings(selectForScope(selection, '', configurations), level),
    };
    const tables = [
        root,
        ...scopes.map<WrittenTable>((table) => {
            const scope = trimTrailingSlashes(table['path'] as string);
            return {
                scope,
                table,
                known: buildKnownSettings(selectForScope(selection, scope, configurations), level),
            };
        }),
    ].toSorted((left, right) => compareScopeDepth(left.scope, right.scope));
    // The writer has no project input to prove a computed default. Keep a written choice until the writer knows that input.
    for (const key of DETECTED_SETTINGS) for (const table of tables) table.known.defaults.delete(key);
    const scopeValues = scopes.map((table) => {
        const scope = trimTrailingSlashes(table['path'] as string);
        const writtenTable = tables.find((entry) => entry.scope === scope) as WrittenTable;
        return stripTableDefaults(writtenTable.table, writtenTable, tables, effectiveSettings);
    });
    const rootValues = stripTableDefaults(settings, root, tables, effectiveSettings);
    return scopes.length > 0 ? { ...rootValues, scope: scopeValues } : rootValues;
}
