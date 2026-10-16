import { z } from 'zod';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import { settingSchema } from '#cli/settings/schema/gspot-toml.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { quoteArgument, formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import { isLoosening, reasonError, isReasonNeeded, isReasonAccepted } from '#cli/settings/errors/reasons.ts';

import type {
    Settings,
    SettingEntry,
    KnownSettings,
    WrittenSetting,
    DeclarationMatch,
} from '#cli/types/settings/values.ts';
import {
    tablesFor,
    everyTable,
    settingTable,
    settingValue,
    declarationFor,
    settingDefault,
    writtenSetting,
} from '#cli/settings/inherit.ts';

function looseningError(key: string, written: WrittenSetting, shipped: unknown, scope: string | undefined): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = JSON.stringify(written.value);
    const argument = typeof written.value === 'string' ? written.value : value;
    return `\`${key} = ${value}\` is looser than the shipped ${shown}, so it needs a reason. Run: gspot set ${quoteArgument(key)} ${quoteArgument(argument)}${scopeFlag} --reason "..."`;
}

// The errors of a written list: bad items, and loosening entries that carry no reason when the declaration requires reasons.
function listErrors(key: string, written: WrittenSetting, match: DeclarationMatch, shipped: unknown): SettingsError[] {
    if (!Array.isArray(written.value)) return [];
    const diagnostic =
        written.reason !== undefined || isLoosening(match.declaration, written.value, shipped)
            ? reasonError(key, written.reason)
            : undefined;
    return diagnostic === undefined ? [] : [{ path: [...key.split('.'), 'reason'], message: diagnostic }];
}

// The error of a written scalar that loosens the shipped default without an accepted reason.
function scalarErrors(
    key: string,
    written: WrittenSetting,
    match: DeclarationMatch,
    scope: string | undefined,
    shipped: unknown,
): SettingsError[] {
    if (written.reason !== undefined) {
        const diagnostic = reasonError(key, written.reason);
        if (diagnostic !== undefined) return [{ path: [...key.split('.'), 'reason'], message: diagnostic }];
    }
    if (!isReasonNeeded(match.declaration, shipped, written.value) || isReasonAccepted(written.reason)) return [];
    const error = looseningError(key, written, shipped, scope);
    return [{ path: key.split('.'), message: error }];
}

function keyErrors(
    known: KnownSettings,
    settings: Settings,
    table: Partial<Settings> & Pick<Settings, 'written'>,
    scope: string | undefined,
    key: string,
): SettingsError[] {
    const match = declarationFor(known, key);
    if (!match) return [{ path: key.split('.'), message: unknownSettingError(known, key) }];
    const written = writtenSetting(table, key);
    if (!written) return [];
    const shipped = settingDefault(
        known,
        match,
        scope ?? '',
        (dependentKey) => (settingValue(known, settings, dependentKey, scope) as SettingEntry).value,
    )?.value;
    if (written.reason !== undefined && !isReasonNeeded(match.declaration, shipped, written.value))
        return [
            {
                path: key.split('.'),
                message: `\`${key}\` does not loosen the default. Write its value without a reason form.`,
            },
        ];
    if (match.declaration.type === 'list') return listErrors(key, written, match, shipped);
    return scalarErrors(key, written, match, scope, shipped);
}

function extraKeyErrors(known: KnownSettings, table: Partial<Settings>): SettingsError[] {
    const errors: SettingsError[] = [];
    const { tools = {} } = table;
    for (const [tool, toolTable] of Object.entries(tools)) {
        const extra = isRecord(toolTable['extra']) ? toolTable['extra'] : {};
        for (const key of Object.keys(extra)) {
            if (known.declarations.has(`tools.${tool}.${key}`))
                errors.push({
                    path: ['tools', tool, 'extra', key],
                    message: `\`${key}\` under [tools.${tool}.extra] already has a declared setting. Move it up to \`tools.${tool}.${key}\` and remove it from extra.`,
                });
        }
    }
    return errors;
}

// Configuration defaults that conflict in the root or a scope. No written table settles them.
function unsettledConflicts(
    known: KnownSettings,
    settings: Settings,
    scopeKnown: Map<string, KnownSettings>,
): SettingsError[] {
    const errors: SettingsError[] = [];
    const knownByScope = [
        { selected: known, scope: undefined, path: ['configurations'] as KeyPath },
        ...Object.keys(settings.scope).map((scope, index) => ({
            selected: scopeKnown.get(scope) ?? known,
            scope,
            path: ['scope', index, 'configurations'] as KeyPath,
        })),
    ];
    for (const { selected, scope, path } of knownByScope) {
        const tables = tablesFor(settings, scope);
        for (const { key, message: text } of selected.errors)
            if (!tables.some(({ table }) => writtenSetting(table, key) !== undefined))
                errors.push({ path, message: text });
    }
    return errors;
}

// Whether a written tool table groups exposed keys rather than exposing one key.
function isKeyGroup(known: KnownSettings, key: string, value: unknown): value is Record<string, unknown> {
    if (known.declarations.has(key) || !isRecord(value)) return false;
    let schema = settingSchema(key);
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodPrefault)
        schema = schema.unwrap() as z.ZodType;
    return schema instanceof z.ZodObject;
}

/**
 * Every setting key a settings table writes, in dotted form.
 * @param settings the root table or one scope table.
 * @param known the selected manifest settings, including nested tool keys.
 * @returns all known written keys, plus unknown keys from open settings tables.
 */
function writtenKeys(settings: Partial<Settings> & Pick<Settings, 'written'>, known: KnownSettings): string[] {
    const keys: string[] = [];
    const pending = (settings.tools === undefined ? [] : Object.entries(settings.tools)).flatMap(([tool, table]) =>
        Object.entries(table)
            .filter(([field]) => field !== 'extra')
            .map(([field, value]) => ({ key: `tools.${tool}.${field}`, value })),
    );
    pending.push(
        ...Object.entries(settings.written).flatMap(([name, table]) => {
            if (known.declarations.has(name)) return [{ key: name, value: table }];
            if (isRecord(table) && name !== 'tools')
                return Object.entries(table).map(([field, value]) => ({ key: `${name}.${field}`, value }));
            return [];
        }),
    );
    for (const { key, value } of pending) {
        if (isKeyGroup(known, key, value))
            pending.push(...Object.entries(value).map(([field, child]) => ({ key: `${key}.${field}`, value: child })));
        else keys.push(key);
    }
    const format = (settings.format === undefined ? [] : Object.keys(settings.format)).map((key) => `format.${key}`);
    const knownKeys = [...known.declarations.keys()].filter((key) => writtenSetting(settings, key) !== undefined);
    return [...new Set([...knownKeys, ...keys, ...format])];
}

/**
 * Names unknown settings and lists the closest keys under the same table.
 * @param known the known settings of the selected configurations.
 * @param key the written setting key.
 * @returns the error and a command for discovering settings.
 */
export function unknownSettingError(known: KnownSettings, key: string): string {
    const all = known.declarations.keys().toArray();
    if (key.startsWith('limits.')) {
        const limits = all.filter((candidate) => candidate.startsWith('limits.'));
        return `\`${key}\` is not a limit any check reads. The limits that exist are ${formatCodeList(limits.map((candidate) => candidate.slice('limits.'.length)))}.`;
    }
    const prefix = settingTable(key);
    const keys = all
        .filter((candidate) => candidate.startsWith(`${prefix}.`))
        .map((candidate) => candidate.slice(prefix.length + 1));
    const near = selectSimilarNames(key.slice(prefix.length + 1), keys);
    const rest = keys.filter((item) => !near.includes(item));
    const suggestions = [...near, ...rest];
    return `No selected configuration has the setting \`${key}\`. ${
        suggestions.length === 0
            ? 'No setting exists under that table.'
            : 'The settings that exist under that table are ' + formatCodeList(suggestions) + '.'
    } Run \`gspot list settings\` to see every one.`;
}

/**
 * Validates every written key against the known settings and the loosening rule.
 * @param known the known settings of the selection.
 * @param settings the loaded settings.
 * @param scopeKnown the known settings of each scope by its path; each scope table uses its own declarations.
 * @param retained the settings saved for configurations whose repository evidence disappeared.
 * @returns the errors in plain English, empty when the settings pass validation.
 */
export function validateAgainstKnownSettings(
    known: KnownSettings,
    settings: Settings,
    scopeKnown: Map<string, KnownSettings>,
    retained: KnownSettings,
): SettingsError[] {
    const errors = unsettledConflicts(known, settings, scopeKnown);
    // A root table feeds every scope, so it may hold a setting that only a configuration of some scope exposes.
    const later = [known, ...scopeKnown.values(), retained].toReversed();
    const everywhere: KnownSettings = {
        declarations: new Map(later.flatMap((entry) => entry.declarations.entries().toArray())),
        defaults: new Map(later.flatMap((entry) => entry.defaults.entries().toArray())),
        errors: known.errors,
    };
    const coverageLines = settingValue(everywhere, settings, 'coverage.lines')?.value;
    const targetErrors = (settings.coverage?.target ?? [])
        .map((target, index) => ({ target, index }))
        .filter(
            ({ target }) =>
                typeof coverageLines === 'number' && target.lines < coverageLines && target.reason === undefined,
        )
        .map(({ index }) => ({
            path: ['coverage', 'target', index, 'reason'],
            message: 'A lower coverage target needs a reason.',
        }));
    errors.push(...targetErrors);
    for (const { table, scope, path } of everyTable(settings)) {
        const active = scope === undefined ? everywhere : (scopeKnown.get(scope) as KnownSettings);
        const selectedKnown: KnownSettings = {
            declarations: new Map([...everywhere.declarations, ...active.declarations]),
            defaults: new Map([...everywhere.defaults, ...active.defaults]),
            errors: active.errors,
        };
        const roleKnown =
            scope === undefined
                ? { declarations: new Map([known, ...scopeKnown.values()].flatMap((entry) => [...entry.declarations])) }
                : active;
        const roles = getValueAt(table.written, ['architecture', 'roles']);
        const undeclaredRoles = Object.keys(isRecord(roles) ? roles : {}).filter(
            (role) =>
                !roleKnown.declarations.has(`architecture.roles.${role}`) &&
                !(role === 'environment_readers' && roleKnown.declarations.has('architecture.roles')),
        );
        const found = [
            ...undeclaredRoles.map((role) => ({
                path: ['architecture', 'roles', role],
                message: `The role ${role} is not declared by a selected configuration.`,
            })),
            ...writtenKeys(table, selectedKnown).flatMap((key) =>
                keyErrors(selectedKnown, settings, table, scope, key),
            ),
            ...extraKeyErrors(selectedKnown, table),
        ];
        errors.push(...found.map((error) => ({ ...error, path: [...path, ...error.path] })));
    }
    return errors;
}
