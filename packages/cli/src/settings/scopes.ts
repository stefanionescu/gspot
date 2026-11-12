import { NAMING_LANGUAGE_CATEGORIES, NAMING_LANGUAGES } from '#cli/config/settings/schema.ts';
import { NO_ROOT_SCOPE_MESSAGE } from '#cli/config/settings/validation.ts';
import { listAlwaysSelected, selectConfigurations } from '#cli/manifests/select.ts';
import { compareScopeDepth, isScopeCovered, selectScopePath } from '#cli/repository/scopes.ts';
import { tableValuesSchema } from '#cli/schemas/settings/configurations.ts';
import { namingCategorySchema } from '#cli/schemas/settings/fields.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { getSettingValue, listInheritedSettings } from '#cli/settings/inherit.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { extractParentFolder, isInScope } from '#cli/system/paths.ts';
import { addTable, findValueAt } from '#cli/system/tables.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type {
    AvailableSettings,
    InheritedSetting,
    RemovedConfiguration,
    Scope,
    ScopeSettings,
    SelectedConfigurations,
    Settings,
    TableSettings,
    TableValues,
} from '#cli/types/settings.ts';

const NAMING_VARIANT_KEYS: readonly string[] = NAMING_LANGUAGES.flatMap((language) =>
    Object.keys(namingCategorySchema.shape).flatMap((field) => [
        `naming.${language}.${field}`,
        ...NAMING_LANGUAGE_CATEGORIES[language].map((category) => `naming.${language}.${category}.${field}`),
    ]),
);

function listLimitVariantKeys(availableSettings: AvailableSettings): string[] {
    return availableSettings.settings
        .values()
        .filter((setting) => setting.name.startsWith('limits.') && setting.type === 'number')
        .flatMap((setting) =>
            (setting.languages ?? []).map(
                (language) => `limits.${language}.${setting.name.slice(setting.name.lastIndexOf('.') + 1)}`,
            ),
        )
        .toArray();
}

function fillTableValues(tables: Record<string, unknown>, rows: InheritedSetting[]): void {
    const valueRows = rows
        .map((row) => {
            const segments = row.key.split('.');
            const [table, tool] = segments;
            const name = table === 'tools' && tool !== undefined ? `${table}.${tool}` : (table as string);
            const path = segments.slice(name.split('.').length);
            return { row, name, path: path.slice(0, -1), field: path.at(-1) ?? '' };
        })
        .filter(
            ({ row, name }) => Object.hasOwn(tableValuesSchema.shape, name) && findSettingSchema(row.key) !== undefined,
        );
    const empty = valueRows.filter(({ row }) => row.value === undefined);
    for (const { row, name } of empty) {
        if (addTable(tables, [name]) === undefined)
            throw new Error(`The setting ${row.key} runs through a non-table value.`);
    }
    const written = valueRows.filter(({ row }) => row.value !== undefined);
    for (const { row, name, path, field } of written) {
        const table = addTable(tables, [name, ...path]);
        if (table === undefined) throw new Error(`The setting ${row.key} runs through a non-table value.`);
        table[field] = row.reason === undefined ? row.value : { value: row.value, reason: row.reason };
    }
}

export function findParentScope(scopes: Scope[], path: string): Scope | undefined {
    if (path === '') return undefined;
    const parent = selectScopePath(extractParentFolder(path), scopes);
    return scopes.find((scope) => scope.path === parent);
}

export function selectConfigurationsForScope(selected: SelectedConfigurations, scopePath: string): Configuration[] {
    const automatic = listAlwaysSelected();
    const choices = new Set<string>([...selected.configurations, ...automatic]);
    const tables = [
        selected,
        ...[...selected.scopes]
            .filter(([ancestor]) => isInScope(scopePath, ancestor))
            .toSorted(([left], [right]) => compareScopeDepth(left, right))
            .map(([, scopeTable]) => scopeTable),
    ];
    for (const table of tables) {
        for (const configuration of table.configurations) choices.add(configuration);
        for (const removed of table.removed_configurations) choices.delete(removed);
    }
    return selectConfigurations([...choices]);
}

export function listRemovedConfigurations(settings: Settings): RemovedConfiguration[] {
    return [['', settings] as const, ...settings.scopes].flatMap(([scopePath, table]) => {
        const reasons = table.written['removed_configurations'] as Record<string, string>;
        return table.removed_configurations.map((name) => ({
            name,
            scope: scopePath,
            reason: reasons[name] as string,
        }));
    });
}

export function buildScopeSettings(
    availableSettings: AvailableSettings,
    settings: Settings,
    configurations: Configuration[],
    scopePath: string,
): ScopeSettings {
    const listed = listInheritedSettings(availableSettings, settings, scopePath);
    const valuesByKey = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    const variants = [...NAMING_VARIANT_KEYS, ...listLimitVariantKeys(availableSettings)]
        .filter((key) => !availableSettings.settings.has(key) && !Object.hasOwn(valuesByKey, key))
        .map((key) => getSettingValue(availableSettings, settings, key, scopePath))
        .filter((row) => row !== undefined);
    fillTableValues(namespaces, [...listed, ...variants]);
    return {
        configurations: configurations.map((configuration) => configuration.name),
        valuesByKey: valuesByKey,
        tables: tableValuesSchema.parse(namespaces),
        test_files: rootSettingSchemas.test_files.unwrap().parse(valuesByKey['test_files']),
        ignores: settings.ignore,
    };
}

export function getTable<Name extends keyof TableValues>(
    scopeSettings: ScopeSettings,
    name: Name,
): TableSettings<Name> {
    const value = scopeSettings.tables[name];
    if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
    return value;
}

export function selectFormat(scopeSettings: ScopeSettings, files: readonly string[]): TableValues['format'] {
    const { format } = scopeSettings.tables;
    const override = format.override.find(({ paths }) => paths.every((path) => files.includes(path)));
    if (override === undefined) return format;
    return {
        ...format,
        indent_style: override.indent_style ?? format.indent_style,
        indent_width: override.indent_width ?? format.indent_width,
        print_width: override.print_width ?? format.print_width,
        trailing_commas: override.trailing_commas ?? format.trailing_commas,
        quotes: override.quotes ?? format.quotes,
    };
}

export function getLimit(scopeSettings: ScopeSettings, key: string, language?: string): number {
    const value =
        findValueAt(scopeSettings.tables.limits, [language ?? '', key]) ??
        findValueAt(scopeSettings.tables.limits, [key]);
    if (typeof value !== 'number')
        throw new TypeError(
            `The selected scope has no ${[language, key].filter((name) => name !== undefined).join('.')} limit.`,
        );
    return value;
}

export function listIgnores(scopeSettings: ScopeSettings, check: string): ScopeSettings['ignores'] {
    return scopeSettings.ignores.filter((ignore) => ignore.check === check || ignore.check === undefined);
}

export function listIgnoredRules(scope: Scope, checkId: string): string[] {
    return scope.settings.ignores
        .filter((ignore) => ignore.check === checkId)
        .filter((ignore) => ignore.paths === undefined || isScopeCovered(ignore.paths, scope.path))
        .map((ignore) => ignore.rule)
        .filter((rule) => rule !== undefined);
}

export function getRootScope(scopes: readonly Scope[]): Scope {
    const root = scopes.find((scope) => scope.path === '');
    if (root === undefined) throw new Error(NO_ROOT_SCOPE_MESSAGE);
    return root;
}
