import { isReasonedValue } from '#cli/settings/file.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { selectConfigurations } from '#cli/manifests/select.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { findSettingSchema } from '#cli/settings/schema-lookup.ts';
import { tableValuesSchema } from '#cli/schemas/settings/tables.ts';
import { namingCategorySchema } from '#cli/schemas/settings/fields.ts';
import { isTable, addTable, findValueAt } from '#cli/system/tables.ts';
import { listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { NO_ROOT_SCOPE_MESSAGE } from '#cli/config/settings/settings.ts';
import { getSettingValue, listInheritedSettings } from '#cli/settings/inherit.ts';
import { isInScope, isScopeCovered, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, TableValues, TableSettings } from '#cli/types/settings/settings.ts';
import { SETTING_LANGUAGES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/naming.ts';

import type {
    Scope,
    ScopeSettings,
    InheritedSetting,
    AvailableSettings,
    RemovedConfiguration,
    SelectedConfigurations,
} from '#cli/types/settings/inheritance.ts';

/**
Find the nearest scope that holds a path.

@param scopes every project scope.
@param path the repository-relative destination.
@returns undefined at the root.
*/
export function findParentScope(scopes: Scope[], path: string): Scope | undefined {
    return scopes
        .filter((scope) => scope.path !== path && isInScope(path, scope.path))
        .toSorted((left, right) => compareScopeDepth(left.path, right.path))
        .at(-1);
}

/**
Select the configurations of the root and each parent scope, each once, in order.

@param selected the configuration lists as written.
@param scopePath the folder to select for.
@param configurationsByName every configuration.
*/
export function selectForScope(
    selected: SelectedConfigurations,
    scopePath: string,
    configurationsByName: Map<string, Configuration>,
): Configuration[] {
    const automatic = listAutomaticConfigurations(configurationsByName);
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
    return selectConfigurations([...choices], configurationsByName);
}

/**
List the configurations that gspot.toml removes, in the root and in each scope, with the reason of each.

@param settings the parsed gspot.toml.
*/
export function listRemovedConfigurations(settings: Settings): RemovedConfiguration[] {
    return [['', settings] as const, ...settings.scopes].flatMap(([scope, table]) =>
        table.removed_configurations.map((name) => ({
            name,
            scope,
            reason: readRemovalReason(table.written['removed_configurations'], name),
        })),
    );
}

function readRemovalReason(written: unknown, name: string): string {
    if (isReasonedValue(written)) return written.reason;
    const reason = isTable(written) ? written[name] : undefined;
    return typeof reason === 'string' ? reason : '';
}

function listNamingVariants(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopePath: string,
): InheritedSetting[] {
    return SETTING_LANGUAGES.flatMap((language) =>
        Object.keys(namingCategorySchema.shape).flatMap((field) => [
            `naming.${language}.${field}`,
            ...NAMING_LANGUAGE_CATEGORIES[language].map((category) => `naming.${language}.${category}.${field}`),
        ]),
    )
        .filter((key) => !availableSettings.settings.has(key))
        .map((key) => getSettingValue(availableSettings, settings, key, scopePath))
        .filter((row) => row !== undefined);
}

function listLimitVariants(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopePath: string,
): InheritedSetting[] {
    return availableSettings.settings
        .values()
        .filter((setting) => setting.name.startsWith('limits.') && setting.type === 'number')
        .flatMap((setting) =>
            (setting.languages ?? []).map(
                (language) => `limits.${language}.${setting.name.slice(setting.name.lastIndexOf('.') + 1)}`,
            ),
        )
        .filter((key) => !availableSettings.settings.has(key))
        .map((key) => getSettingValue(availableSettings, settings, key, scopePath))
        .filter((row) => row !== undefined)
        .toArray();
}

/**
Build the merged settings of a scope from the known settings, the written settings, and the configurations of the
scope.

@param availableSettings the settings and defaults of the selected configurations.
@param settings the written root values and scoped overrides.
@param configurations the configurations that the scope selects.
@param scopePath the folder, '' for the root.
*/
export function buildScopeSettings(
    availableSettings: AvailableSettings,
    settings: Settings,
    configurations: Configuration[],
    scopePath: string,
): ScopeSettings {
    const listed = listInheritedSettings(availableSettings, settings, scopePath);
    const valuesByKey = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    fillTableValues(namespaces, listed);
    fillTableValues(namespaces, listNamingVariants(availableSettings, settings, scopePath));
    fillTableValues(namespaces, listLimitVariants(availableSettings, settings, scopePath));
    return {
        configurations: configurations.map((configuration) => configuration.name),
        valuesByKey: valuesByKey,
        tables: tableValuesSchema.parse(namespaces),
        test_files: rootSettingSchemas.test_files.unwrap().parse(valuesByKey['test_files']),
        ignores: settings.ignore.map((ignore) => ({ ...ignore, paths: ignore.paths ?? [] })),
    };
}

/**
Read one validated table from the scope's merged values.

@param scopeSettings the merged scope data.
@param name the table's dotted name.
*/
export function getTable<Name extends keyof TableValues>(
    scopeSettings: ScopeSettings,
    name: Name,
): TableSettings<Name> {
    const value = scopeSettings.tables[name];
    if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
    return value;
}

/**
Read a language's limit, falling back to the scope's general limit.

@param scopeSettings the merged scope data.
@param key the limit name.
@param language the language, if the check reads a language-specific value.
*/
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

/**
List the written ignores that apply to a check or to every check.

@param scopeSettings the merged scope data.
@param check the check name.
@returns the matching ignores with normalized paths.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Planning and five generators select the ignores of one check by this rule: an ignore without a check covers every check.
export function listIgnores(scopeSettings: ScopeSettings, check: string): ScopeSettings['ignores'] {
    return scopeSettings.ignores.filter((ignore) => ignore.check === check || ignore.check === undefined);
}

/**
List the lint rules disabled throughout the selected scope.

@param scope the scope and its merged data.
@param checkId the check name.
*/
export function listIgnoredRules(scope: Scope, checkId: string): string[] {
    return scope.settings.ignores
        .filter((ignore) => ignore.check === checkId)
        .filter((ignore) => ignore.paths.length === 0 || isScopeCovered(ignore.paths, scope.path))
        .map((ignore) => ignore.rule)
        .filter((rule) => rule !== undefined);
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

/**
Find the root scope, which every run has.

@param scopes every scope, the root among them.
@returns the scope with an empty path.
*/
export function getRootScope(scopes: readonly Scope[]): Scope {
    const root = scopes.find((scope) => scope.path === '');
    if (root === undefined) throw new Error(NO_ROOT_SCOPE_MESSAGE);
    return root;
}
