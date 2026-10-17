import { z } from 'zod';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import type { SettingsError } from '#cli/types/settings/file.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { unwrapSettingSchema } from '#cli/settings/schema/parts.ts';
import { findSettingSchema } from '#cli/settings/schema/gspot-toml.ts';
import { ENVIRONMENT_READERS_ROLE } from '#cli/config/settings/values.ts';
import { quoteArgument, formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import { isLoosening, validateReason, isReasonAccepted } from '#cli/settings/validation/reasons.ts';

import type {
    Settings,
    KnownSettings,
    WrittenSetting,
    EffectiveSetting,
    DeclarationMatch,
} from '#cli/types/settings/values.ts';
import {
    getSettingTable,
    getSettingValue,
    findDeclaration,
    getWrittenSetting,
    listSettingsTables,
    findSettingDefault,
    listApplicableTables,
} from '#cli/settings/inherit.ts';

function formatLooseningError(
    key: string,
    written: WrittenSetting,
    shipped: unknown,
    scope: string | undefined,
): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = JSON.stringify(written.value);
    const argument = typeof written.value === 'string' ? written.value : value;
    return `\`${key} = ${value}\` is looser than the shipped ${shown}, so it needs a reason. Run: gspot set ${quoteArgument(key)} ${quoteArgument(argument)}${scopeFlag} --reason "..."`;
}

// List the errors of a written list: bad items, and loosening items without a reason when the declaration requires reasons.
function listErrors(key: string, written: WrittenSetting, match: DeclarationMatch, shipped: unknown): SettingsError[] {
    if (!Array.isArray(written.value)) return [];
    const message =
        written.reason !== undefined || isLoosening(match.declaration, written.value, shipped)
            ? validateReason(key, written.reason)
            : undefined;
    return message === undefined ? [] : [{ path: [...key.split('.'), 'reason'], message }];
}

// Find the error of a written single value that loosens the shipped default without an accepted reason.
function validateScalar(
    key: string,
    written: WrittenSetting,
    match: DeclarationMatch,
    scope: string | undefined,
    shipped: unknown,
): SettingsError[] {
    if (written.reason !== undefined) {
        const message = validateReason(key, written.reason);
        if (message !== undefined) return [{ path: [...key.split('.'), 'reason'], message }];
    }
    if (!isLoosening(match.declaration, written.value, shipped) || isReasonAccepted(written.reason)) return [];
    const error = formatLooseningError(key, written, shipped, scope);
    return [{ path: key.split('.'), message: error }];
}

function validateWrittenKey(
    known: KnownSettings,
    settings: Settings,
    table: Partial<Settings> & Pick<Settings, 'written'>,
    scope: string | undefined,
    key: string,
): SettingsError[] {
    const match = findDeclaration(known, key);
    if (!match) return [{ path: key.split('.'), message: formatUnknownSetting(known, key) }];
    const written = getWrittenSetting(table, key);
    if (!written) return [];
    const shipped = findSettingDefault(
        known,
        match,
        scope ?? '',
        (dependentKey) => (getSettingValue(known, settings, dependentKey, scope) as EffectiveSetting).value,
    )?.value;
    if (written.reason !== undefined && !isLoosening(match.declaration, written.value, shipped))
        return [
            {
                path: key.split('.'),
                message: `\`${key}\` does not loosen the default. Write it as a plain value, without a reason.`,
            },
        ];
    if (match.declaration.type === 'list') return listErrors(key, written, match, shipped);
    return validateScalar(key, written, match, scope, shipped);
}

function validateExtraKeys(known: KnownSettings, table: Partial<Settings>): SettingsError[] {
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
function listUnsettledConflicts(
    known: KnownSettings,
    settings: Settings,
    scopeKnown: Map<string, KnownSettings>,
): SettingsError[] {
    const errors: SettingsError[] = [];
    const knownByScope = [
        { selected: known, scope: undefined, path: ['configurations'] as KeyPath },
        ...[...scopeKnown].map(([scope, selected], index) => ({
            selected,
            scope,
            path: ['scope', index, 'configurations'] as KeyPath,
        })),
    ];
    for (const { selected, scope, path } of knownByScope) {
        const tables = listApplicableTables(settings, scope);
        for (const { key, message: text } of selected.errors)
            if (!tables.some(({ table }) => getWrittenSetting(table, key) !== undefined))
                errors.push({ path, message: text });
    }
    return errors;
}

// Check whether a written tool table groups exposed keys instead of exposing one key.
function isKeyGroup(known: KnownSettings, key: string, value: unknown): value is Record<string, unknown> {
    if (known.declarations.has(key) || !isRecord(value)) return false;
    let schema = findSettingSchema(key);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    return schema instanceof z.ZodObject;
}

/**
 * List every setting key that a settings table writes, in dotted form.
 * @param settings the root table or one scope.
 * @param known the declarations, with nested tool keys.
 * @returns all known written keys, plus unknown keys from open settings tables.
 */
function listWrittenKeys(settings: Partial<Settings> & Pick<Settings, 'written'>, known: KnownSettings): string[] {
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
    const knownKeys = [...known.declarations.keys()].filter((key) => getWrittenSetting(settings, key) !== undefined);
    return [...new Set([...knownKeys, ...keys, ...format])];
}

/**
 * Name an unknown setting, and list the closest keys in the same table.
 * @param known the declarations of the configurations.
 * @param key the written dotted name.
 * @returns the error, with a command that lists the settings.
 */
function formatUnknownSetting(known: KnownSettings, key: string): string {
    const all = known.declarations.keys().toArray();
    if (key.startsWith('limits.')) {
        const limits = all.filter((candidate) => candidate.startsWith('limits.'));
        return `\`${key}\` is not a limit any check reads. The limits that exist are ${formatCodeList(limits.map((candidate) => candidate.slice('limits.'.length)))}.`;
    }
    const prefix = getSettingTable(key);
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
 * Validate every written key against the known settings and the loosening rule.
 * @param known the declarations and defaults of the selection.
 * @param settings the parsed gspot.toml.
 * @param scopeKnown the declarations of each scope by path, which its own table uses.
 * @param retained the settings saved for configurations whose repository evidence disappeared.
 * @returns the errors in plain English, empty when the settings pass validation.
 */
function validateKeys(
    known: KnownSettings,
    settings: Settings,
    scopeKnown: Map<string, KnownSettings>,
    retained: KnownSettings,
): SettingsError[] {
    const errors = listUnsettledConflicts(known, settings, scopeKnown);
    // A root table feeds every scope, so it may hold a setting that only a configuration of some scope exposes.
    const later = [known, ...scopeKnown.values(), retained].toReversed();
    const everywhere: KnownSettings = {
        declarations: new Map(later.flatMap((entry) => entry.declarations.entries().toArray())),
        defaults: new Map(later.flatMap((entry) => entry.defaults.entries().toArray())),
        errors: known.errors,
    };
    const coverageLines = getSettingValue(everywhere, settings, 'coverage.lines')?.value;
    const targetErrors = (settings.coverage?.swift_target ?? [])
        .map((target, index) => ({ target, index }))
        .filter(
            ({ target }) =>
                typeof coverageLines === 'number' && target.lines < coverageLines && target.reason === undefined,
        )
        .map(({ index }) => ({
            path: ['coverage', 'swift_target', index, 'reason'],
            message: 'A lower coverage target needs a reason.',
        }));
    errors.push(...targetErrors);
    for (const { table, scope, path } of listSettingsTables(settings)) {
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
                !(role === ENVIRONMENT_READERS_ROLE && roleKnown.declarations.has('architecture.roles')),
        );
        const found = [
            ...undeclaredRoles.map((role) => ({
                path: ['architecture', 'roles', role],
                message: `The role ${role} is not declared by a selected configuration.`,
            })),
            ...listWrittenKeys(table, selectedKnown).flatMap((key) =>
                validateWrittenKey(selectedKnown, settings, table, scope, key),
            ),
            ...validateExtraKeys(selectedKnown, table),
        ];
        errors.push(...found.map((error) => ({ ...error, path: [...path, ...error.path] })));
    }
    return errors;
}

export { validateKeys, formatUnknownSetting };
