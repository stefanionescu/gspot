import type { z } from 'zod';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import { TOOL_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import { namingCategorySchema } from '#cli/policy/schema/contracts.ts';
import { settingValueSchemas } from '#cli/policy/schema/native/public.ts';
import { similar, codeList, isRecord, quoteArgument } from '#cli/platform/contracts.ts';
import { tablesFor, everyTable, policyValue, declarationFor } from '#cli/policy/settings/contracts.ts';
import { isLoosening, isReasonOwed, isReasonAccepted, reasonDiagnostic } from '#cli/policy/errors/contracts.ts';

import type {
    Policy,
    NamingTable,
    PolicyError,
    KnownSettings,
    AuthoredSetting,
    DeclarationMatch,
} from '#cli/types/policy/settings.ts';

// A table typed inside quotes is one string to TOML, and nothing reads a string where a table belongs.
function quotedTableDiagnostic(key: string, item: unknown): string | undefined {
    const text = typeof item === 'string' ? item.trim() : '';
    const isQuoted = (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[{') && text.endsWith('}]'));
    return isQuoted
        ? `${key} holds a table written inside quotes: ${text}. Take the quotes away, or write it under [[${key}]].`
        : undefined;
}

function looseningDiagnostic(
    key: string,
    written: AuthoredSetting,
    shipped: unknown,
    scope: string | undefined,
): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = JSON.stringify(written.value);
    return `\`${key} = ${value}\` is looser than the shipped ${shown}, so it needs a reason. Run: gspot set ${quoteArgument(key)} ${quoteArgument(value)}${scopeFlag} --reason "..."`;
}

// The errors of a written list: bad items, and loosening entries that carry no reason when reasons are required.
function listErrors(key: string, written: AuthoredSetting, match: DeclarationMatch, shipped: unknown): PolicyError[] {
    if (!Array.isArray(written.value)) return [];
    const items: unknown[] = written.value;
    const quoted = items.flatMap((item, index): PolicyError[] => {
        const diagnostic = quotedTableDiagnostic(key, item);
        return diagnostic === undefined ? [] : [{ path: [...key.split('.'), index], message: diagnostic }];
    });
    const reasons = items
        .flatMap((item, index) => (isRecord(item) ? [{ item, index }] : []))
        .filter(({ item }) => item['reason'] !== undefined || match.declaration.direction === 'loosening')
        .filter(
            ({ item }) =>
                match.declaration.reason_identity === undefined ||
                item['reason'] === undefined ||
                item['reason'] !== item[match.declaration.reason_identity],
        )
        .flatMap(({ item, index }): PolicyError[] => {
            const path = [...key.split('.'), index, 'reason'];
            const authored = item['reason'];
            if (authored !== undefined && typeof authored !== 'string')
                return [{ path, message: `${key} needs a reason written as a string.` }];
            const name = item['name'] ?? item['group'];
            const where = typeof name === 'string' ? `${key} ${name}` : key;
            const diagnostic = reasonDiagnostic(where, authored);
            return diagnostic === undefined ? [] : [{ path, message: diagnostic }];
        });
    const primitive = items.some((item) => !isRecord(item));
    const needsReason =
        primitive &&
        match.declaration.reason_identity === undefined &&
        isLoosening(match.declaration, written.value, shipped);
    const diagnostic = written.reason !== undefined || needsReason ? reasonDiagnostic(key, written.reason) : undefined;
    const listReason = diagnostic === undefined ? [] : [{ path: ['reasons', key], message: diagnostic }];
    return [...quoted, ...reasons, ...listReason];
}

// The error of a written scalar that loosens the shipped default without an accepted reason.
function scalarErrors(
    surface: KnownSettings,
    key: string,
    written: AuthoredSetting,
    match: DeclarationMatch,
    scope: string | undefined,
): PolicyError[] {
    if (written.reason !== undefined) {
        const diagnostic = reasonDiagnostic(key, written.reason);
        if (diagnostic !== undefined) return [{ path: ['reasons', key], message: diagnostic }];
    }
    const shipped = surface.defaults.get(match.declaration.name)?.value;
    if (!isReasonOwed(match.declaration, shipped, written.value) || isReasonAccepted(written.reason)) return [];
    const error = looseningDiagnostic(key, written, shipped, scope);
    return [{ path: key.split('.'), message: error }];
}

function keyErrors(
    surface: KnownSettings,
    table: Partial<Policy>,
    scope: string | undefined,
    key: string,
): PolicyError[] {
    const match = declarationFor(surface, key);
    if (!match) return [{ path: key.split('.'), message: unknownSettingDiagnostic(surface, key) }];
    const written = policyValue(table, key);
    if (!written) return [];
    if (key.startsWith('limits.')) {
        const schema = new Map<string, z.ZodType>(Object.entries(settingValueSchemas)).get(match.declaration.name);
        if (schema === undefined) throw new Error(`No compiled schema owns ${match.declaration.name}.`);
        const validated = schema.safeParse(written.value);
        if (!validated.success)
            return [
                {
                    path: key.split('.'),
                    message: `The setting ${key}: ${validated.error.issues.map((issue) => issue.message).join('; ')}`,
                },
            ];
    }
    if (match.declaration.type === 'list')
        return listErrors(key, written, match, surface.defaults.get(match.declaration.name)?.value);
    return scalarErrors(surface, key, written, match, scope);
}

function extraDuplicateErrors(surface: KnownSettings, table: Partial<Policy>): PolicyError[] {
    const errors: PolicyError[] = [];
    const { tools = {} } = table;
    for (const [tool, toolTable] of Object.entries(tools)) {
        const { verbatim = {} } = toolTable;
        for (const key of Object.keys(verbatim)) {
            if (surface.declarations.has(`tools.${tool}.${key}`))
                errors.push({
                    path: ['tools', tool, 'verbatim', key],
                    message: `\`${key}\` under [tools.${tool}.verbatim] already has a declared setting. Move it up to \`tools.${tool}.${key}\` and remove it from verbatim.`,
                });
        }
    }
    return errors;
}

// Configuration defaults that conflict in the root or a scope. No authored table settles them.
function unsettledConflicts(
    surface: KnownSettings,
    policy: Policy,
    scopeSurfaces: Map<string, KnownSettings>,
): PolicyError[] {
    const errors: PolicyError[] = [];
    const surfaces = [
        { settings: surface, scope: undefined, path: ['configurations'] as KeyPath },
        ...Object.keys(policy.scope).map((scope) => ({
            settings: scopeSurfaces.get(scope) ?? surface,
            scope,
            path: ['scope', scope, 'configurations'] as KeyPath,
        })),
    ];
    for (const { settings, scope, path } of surfaces) {
        const layers = tablesFor(policy, scope);
        for (const { key, message: text } of settings.errors)
            if (!layers.some(({ table }) => policyValue(table, key) !== undefined))
                errors.push({ path, message: text });
    }
    return errors;
}

function limitKeys(policy: Partial<Policy>): string[] {
    if (!policy.limits) return [];
    const keys = Object.keys(policy.limits.root).map((key) => `limits.${key}`);
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const key of Object.keys(table)) keys.push(`limits.${group}.${key}`);
    return keys;
}

function scalarKeys(prefix: string, table: NamingTable): string[] {
    return Object.keys(namingCategorySchema.shape)
        .filter((key) => Object.hasOwn(table, key))
        .map((key) => `${prefix}.${key}`);
}

function namingKeys(policy: Partial<Policy>): string[] {
    if (!policy.naming) return [];
    const keys: string[] = [];
    for (const [language, table] of Object.entries(policy.naming.languages)) {
        keys.push(...scalarKeys(`naming.${language}`, table));
        for (const [category, inner] of Object.entries(table.categories))
            keys.push(...scalarKeys(`naming.${language}.${category}`, inner));
    }
    return keys;
}

// Whether a written tool table is a group of exposed keys rather than one exposed key.
function isKeyGroup(surface: KnownSettings, key: string, value: unknown): value is Record<string, unknown> {
    if (surface.declarations.has(key) || !isRecord(value)) return false;
    return [...surface.declarations.keys()].some((name) => name.startsWith(`${key}.`));
}

/**
 * Every setting key a policy table writes, in dotted form.
 * @param policy the root table or one scope table.
 * @param surface the selected manifest settings, including nested tool keys.
 * @returns all known written keys, plus unknown keys from open settings tables.
 */
function writtenKeys(policy: Partial<Policy>, surface: KnownSettings): string[] {
    const keys: string[] = [];
    const pending = (policy.tools === undefined ? [] : Object.entries(policy.tools)).flatMap(([tool, table]) =>
        Object.entries(table)
            .filter(([slot]) => slot !== 'verbatim')
            .map(([slot, value]) => ({ key: `tools.${tool}.${slot}`, value })),
    );
    pending.push(
        ...(policy.configurationSettings === undefined ? [] : Object.entries(policy.configurationSettings)).flatMap(
            ([name, table]) => Object.entries(table).map(([slot, value]) => ({ key: `${name}.${slot}`, value })),
        ),
    );
    for (const { key, value } of pending) {
        if (isKeyGroup(surface, key, value))
            pending.push(...Object.entries(value).map(([slot, child]) => ({ key: `${key}.${slot}`, value: child })));
        else keys.push(key);
    }
    const format = (policy.format === undefined ? [] : Object.keys(policy.format)).map((key) => `format.${key}`);
    const known = [...surface.declarations.keys()].filter((key) => policyValue(policy, key) !== undefined);
    return [...new Set([...known, ...limitKeys(policy), ...namingKeys(policy), ...keys, ...format])];
}

/**
 * Names unknown settings and lists the closest keys under the same table.
 * @param surface the known settings of the selected configurations.
 * @param key the authored setting key.
 * @returns the error and a command for discovering settings.
 */
export function unknownSettingDiagnostic(surface: KnownSettings, key: string): string {
    const all = surface.declarations.keys().toArray();
    if (key.startsWith('limits.')) {
        const limits = all.filter((candidate) => candidate.startsWith('limits.'));
        return `\`${key}\` is not a limit any check reads. The limits that exist are ${codeList(limits.map((candidate) => candidate.slice('limits.'.length)))}.`;
    }
    const depth = key.startsWith('tools.') ? TOOL_KEY_DEPTH : 1;
    const prefix = key.split('.').slice(0, depth).join('.');
    const known = all
        .filter((candidate) => candidate.startsWith(`${prefix}.`))
        .map((candidate) => candidate.slice(prefix.length + 1));
    const near = similar(key.slice(prefix.length + 1), known);
    const rest = known.filter((item) => !near.includes(item));
    const suggestions = [...near, ...rest];
    return `No selected configuration has the setting \`${key}\`. ${
        suggestions.length === 0
            ? 'No setting exists under that table.'
            : 'The settings that exist under that table are ' + codeList(suggestions) + '.'
    } Run \`gspot list settings\` to see every one.`;
}

/**
 * Validates every written key against the surface and the loosening rule.
 * @param surface the surface of the selection.
 * @param policy the loaded policy.
 * @param scopeSurfaces the surface of each scope by its path; a scope table is read against its own.
 * @param retained the settings saved for configurations whose repository evidence disappeared.
 * @returns the errors in plain English, empty when the policy is sound.
 */
export function validateAgainstSurface(
    surface: KnownSettings,
    policy: Policy,
    scopeSurfaces: Map<string, KnownSettings>,
    retained?: KnownSettings,
): PolicyError[] {
    const errors = unsettledConflicts(surface, policy, scopeSurfaces);
    // A root table feeds every scope, so it may hold a setting that only a configuration of some scope exposes.
    const later = [surface, ...scopeSurfaces.values(), ...(retained === undefined ? [] : [retained])].toReversed();
    const everywhere: KnownSettings = {
        declarations: new Map(later.flatMap((entry) => entry.declarations.entries().toArray())),
        defaults: new Map(later.flatMap((entry) => entry.defaults.entries().toArray())),
        errors: surface.errors,
    };
    for (const { table, scope, path } of everyTable(policy)) {
        const active = scope === undefined ? everywhere : (scopeSurfaces.get(scope) ?? surface);
        const settings: KnownSettings = {
            declarations: new Map([...everywhere.declarations, ...active.declarations]),
            defaults: new Map([...everywhere.defaults, ...active.defaults]),
            errors: active.errors,
        };
        const found = [
            ...writtenKeys(table, settings).flatMap((key) => keyErrors(settings, table, scope, key)),
            ...extraDuplicateErrors(settings, table),
        ];
        errors.push(...found.map((error) => ({ ...error, path: [...path, ...error.path] })));
    }
    return errors;
}
