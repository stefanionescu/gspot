import { z } from 'zod';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { findSettingSchema, unwrapSettingSchema } from '#cli/settings/lookup.ts';

import type {
    Settings,
    ReasonedValue,
    SettingsTable,
    WrittenSetting,
    AvailableSettings,
    WrittenScopeTable,
} from '#cli/types/settings.ts';

function isKeyGroup(
    availableSettings: AvailableSettings,
    key: string,
    value: unknown,
): value is Record<string, unknown> {
    if (availableSettings.settings.has(key) || !isTable(value)) return false;
    let schema = findSettingSchema(key);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    return schema instanceof z.ZodObject;
}

export function isReasonedValue(value: unknown): value is ReasonedValue<unknown> {
    return isTable(value) && Object.hasOwn(value, 'value') && Object.hasOwn(value, 'reason');
}

export function isSettingEmpty(value: unknown): boolean {
    if (typeof value === 'object' && value !== null) return Object.values(value).flat().length === 0;
    const empty: unknown[] = [undefined, false, ''];
    return empty.includes(value);
}

export function listSettingsTables(settings: Settings): WrittenScopeTable[] {
    return [
        { table: settings, scopePath: '', path: [] },
        ...[...settings.scopes].map(
            ([scopePath, table], index) => ({ table, scopePath, path: ['scope', index] }) satisfies WrittenScopeTable,
        ),
    ];
}

export function listApplicableTables(settings: Settings, scopePath: string): WrittenScopeTable[] {
    return listSettingsTables(settings)
        .filter((settingsTable) => settingsTable.scopePath === '' || isInScope(scopePath, settingsTable.scopePath))
        .toSorted((left, right) => compareScopeDepth(left.scopePath, right.scopePath));
}

export function findWrittenSetting(settings: Pick<Settings, 'written'>, key: string): WrittenSetting | undefined {
    const value: unknown = findValueAt(settings.written, key.split('.'));
    if (value === undefined) return undefined;
    return isReasonedValue(value)
        ? {
              value: value.value,
              reason: value.reason,
          }
        : { value };
}

export function listWrittenKeys(settings: SettingsTable, availableSettings: AvailableSettings): string[] {
    const keys: string[] = [];
    const pending = Object.entries(settings.written).flatMap(([name, table]) => {
        const fields = name !== 'removed_configurations' && isTable(table) ? Object.entries(table) : [];
        return availableSettings.settings.has(name)
            ? { key: name, value: table }
            : fields.map(([field, value]) => ({ key: `${name}.${field}`, value }));
    });
    let offset = 0;
    while (offset < pending.length) {
        const { key, value } = pending[offset] as (typeof pending)[number];
        offset++;
        if (isKeyGroup(availableSettings, key, value))
            pending.push(...Object.entries(value).map(([field, child]) => ({ key: `${key}.${field}`, value: child })));
        else keys.push(key);
    }
    const settingKeys = availableSettings.settings
        .keys()
        .filter((key) => findWrittenSetting(settings, key) !== undefined)
        .toArray();
    return [...new Set([...settingKeys, ...keys])];
}
