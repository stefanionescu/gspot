import { createTable } from '#cli/system/values.ts';
import { isScopeCovered } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { IgnoreEntry } from '#cli/types/settings/file.ts';
import { ISO_DATE_LENGTH } from '#cli/config/settings/values.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/schema.ts';
import { tableValuesSchema } from '#cli/settings/schema/tables.ts';
import { NAMED_CATEGORIES } from '#cli/config/checks/general/naming.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { architectureSchema } from '#cli/settings/schema/architecture.ts';
import { limitTableSchema, namingCategorySchema } from '#cli/settings/schema/parts.ts';
import { listSettings, getSettingValue, getSettingTable, listApplicableTables } from '#cli/settings/inherit.ts';

import {
    type Settings,
    type ScopeView,
    type SettingEntry,
    type KnownSettings,
    type ScopeSettings,
} from '#cli/types/settings/values.ts';

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param settings the repository settings, including inactive ignores.
 * @returns the ignores that apply today in UTC.
 */
function listActiveIgnores(settings: Settings): IgnoreEntry[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return settings.ignore.filter((entry) => entry.until === undefined || today < entry.until.toISOString());
}

/**
 * Builds the merged view for a scope from the known settings, the settings and the scope's selection.
 * @param known the known settings of the selection.
 * @param settings the settings.
 * @param selected the selected manifests.
 * @param scope the scope path, '' for the root.
 * @returns the view the templates read.
 */
function buildScopeView(known: KnownSettings, settings: Settings, selected: Manifest[], scope: string): ScopeView {
    const {
        settings: entries,
        values,
        limits,
        test_files: testFiles,
    } = buildScopeSettings(known, settings, selected, scope);
    const ignores = listActiveIgnores(settings).map((entry) => ({ ...entry, paths: entry.paths ?? [] }));
    const format = values.format;
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        test_files: testFiles,
        settings: entries,
        values,
        roles: values.architecture?.roles ?? architectureSchema.shape.roles.parse(undefined),
        format,
        limit: (key, language) => {
            const value = limits[`${language ?? ''}.${key}`] ?? limits[`.${key}`];
            if (value === undefined)
                throw new Error(
                    `The selected scope has no ${[language, key].filter((part) => part !== undefined).join('.')} limit.`,
                );
            return value;
        },
        options: (name) => {
            const value = values[name];
            if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
            return value;
        },
        ignoresFor: (check) => ignores.filter((entry) => entry.check === check),
        rulesOff: (check) =>
            ignores
                .filter((entry) => entry.check === check)
                .filter((entry) => entry.paths.length === 0 || isScopeCovered(entry.paths, scope))
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        extra: (name) => {
            const found = listApplicableTables(settings, scope)
                .map(({ table }) => table.tools?.[name]?.['extra'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            if (found.length === 0) return undefined;
            return Object.fromEntries(found.flatMap((value) => Object.entries(value)));
        },
    };
}

/**
 * Read the merged settings of the repository root.
 * @param scopes the command's validated scope selections.
 * @returns the root scope's merged view.
 */

function listNamingVariants(known: KnownSettings, settings: Settings, scope: string): SettingEntry[] {
    return SETTING_LANGUAGES.flatMap((language) =>
        Object.keys(namingCategorySchema.shape).flatMap((field) => [
            `naming.${language}.${field}`,
            ...NAMED_CATEGORIES.map((category) => `naming.${language}.${category}.${field}`),
        ]),
    )
        .filter((key) => !known.declarations.has(key))
        .map((key) => getSettingValue(known, settings, key, scope))
        .filter((row) => row !== undefined);
}

/**
 * Resolve the selected known settings once into validated namespace values and numeric limits.
 * @param known the selected declarations and defaults.
 * @param settings the written repository settings.
 * @param selected the selected configurations.
 * @param scope the selected scope path.
 * @returns typed execution values without adding defaults to written tables.
 */
function buildScopeSettings(
    known: KnownSettings,
    settings: Settings,
    selected: Manifest[],
    scope: string,
): ScopeSettings {
    const listed = listSettings(known, settings, scope);
    const entries = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    fillTableValues(namespaces, listed);
    const variants = listNamingVariants(known, settings, scope);
    fillTableValues(namespaces, variants);
    const declarations = [...known.declarations.values()].filter(
        (entry) => entry.name.startsWith('limits.') && entry.type === 'number',
    );
    const keys = [...new Set(declarations.map((entry) => entry.name.slice(entry.name.lastIndexOf('.') + 1)))];
    const languages = [
        ...new Set([
            '',
            ...selected.map((manifest) => manifest.configuration.name),
            ...declarations.flatMap((entry) => entry.name.split('.').slice(1, -1)),
            ...listApplicableTables(settings, scope).flatMap(({ table }) =>
                table.limits === undefined
                    ? []
                    : Object.entries(table.limits)
                          .filter(([, value]) => typeof value === 'object')
                          .map(([language]) => language),
            ),
        ]),
    ];
    const limits = limitTableSchema.parse(
        Object.fromEntries(
            keys.flatMap((key) =>
                languages
                    .map((language) => [
                        `${language}.${key}`,
                        getSettingValue(
                            known,
                            settings,
                            language === '' ? `limits.${key}` : `limits.${language}.${key}`,
                            scope,
                        )?.value,
                    ])
                    .filter(([, value]) => value !== undefined),
            ),
        ),
    );
    return {
        settings: entries,
        values: tableValuesSchema.parse(namespaces),
        limits,
        test_files: rootSettingSchemas.test_files.unwrap().parse(entries['test_files']),
    };
}

/**
 * Fill settings tables from direct settings and their declared naming variants.
 * @param namespaces the scope's execution tables.
 * @param rows the values already resolved through the selected declarations.
 */
function fillTableValues(namespaces: Record<string, unknown>, rows: SettingEntry[]): void {
    const entries = rows
        .filter((row) => Object.hasOwn(tableValuesSchema.in.shape, getSettingTable(row.key)))
        .map((row) => {
            const segments = row.key.split('.');
            const name = getSettingTable(row.key);
            const path = segments.slice(name.split('.').length);
            return { row, name, path: path.slice(0, -1), field: path.slice(-1).join('') };
        });
    for (const { row, name } of entries.filter(({ row }) => row.value === undefined)) {
        if (createTable(namespaces, [name]) === undefined)
            throw new Error(`The setting ${row.key} runs through a non-table value.`);
    }
    for (const { row, name, path, field } of entries.filter(({ row }) => row.value !== undefined)) {
        const table = createTable(namespaces, [name, ...path]);
        if (table === undefined) throw new Error(`The setting ${row.key} runs through a non-table value.`);
        table[field] = row.reason === undefined ? row.value : { value: row.value, reason: row.reason };
    }
}

export { buildScopeView, listActiveIgnores };
