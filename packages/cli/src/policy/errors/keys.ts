import { isRecord } from '#cli/platform/objects.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { similar, codeList } from '#cli/platform/text.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';
import { TOOL_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import { namingCategorySchema } from '#cli/policy/schema/fields.ts';
import { settingValueSchema } from '#cli/parsers/schema/settings.ts';
import { specFor, tablesFor, everyTable, policyValue } from '#cli/policy/settings/entries.ts';
import { isLoosening, isReasonAccepted, reasonDiagnostic } from '#cli/policy/errors/reasons.ts';

import type {
    Policy,
    Reasoned,
    SpecMatch,
    NamingTable,
    KnownSettings,
    PolicyProblem,
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
    written: Reasoned<unknown>,
    shipped: unknown,
    scope: string | undefined,
): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = JSON.stringify(written.value);
    return `\`${key} = ${value}\` is looser than the shipped ${shown}, so it needs a reason. Run: gspot set ${quoteArgument(key)} ${quoteArgument(value)}${scopeFlag} --reason "..."`;
}

// The problems of a written list: bad items, and loosening entries that carry no reason when reasons are required.
function listProblems(
    key: string,
    written: Reasoned<unknown>,
    match: SpecMatch,
    requireReasons: boolean,
    shipped: unknown,
): PolicyProblem[] {
    if (!Array.isArray(written.value)) return [];
    const items = written.value as unknown[];
    const quoted = items.flatMap((item, index): PolicyProblem[] => {
        const diagnostic = quotedTableDiagnostic(key, item);
        return diagnostic === undefined ? [] : [{ path: [...key.split('.'), index], message: diagnostic }];
    });
    if (!requireReasons) return quoted;
    const reasons = items
        .flatMap((item, index) => (isRecord(item) ? [{ item, index }] : []))
        .filter(({ item }) => item['reason'] !== undefined || match.spec.direction === 'loosening')
        .filter(
            ({ item }) =>
                match.spec.reason_identity === undefined ||
                item['reason'] === undefined ||
                item['reason'] !== item[match.spec.reason_identity],
        )
        .flatMap(({ item, index }): PolicyProblem[] => {
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
        primitive && match.spec.reason_identity === undefined && isLoosening(match.spec, written.value, shipped);
    const diagnostic = written.reason !== undefined || needsReason ? reasonDiagnostic(key, written.reason) : undefined;
    const listReason = diagnostic === undefined ? [] : [{ path: [...key.split('.'), 'reason'], message: diagnostic }];
    return [...quoted, ...reasons, ...listReason];
}

// The problem of a written scalar that loosens the shipped default without an accepted reason.
function scalarProblems(
    surface: KnownSettings,
    key: string,
    written: Reasoned<unknown>,
    match: SpecMatch,
    scope: string | undefined,
): PolicyProblem[] {
    if (written.reason !== undefined) {
        const diagnostic = reasonDiagnostic(key, written.reason);
        if (diagnostic !== undefined) return [{ path: [...key.split('.'), 'reason'], message: diagnostic }];
    }
    const shipped = surface.defaults.get(match.spec.name)?.value;
    if (!isLoosening(match.spec, written.value, shipped) || isReasonAccepted(written.reason)) return [];
    const problem = looseningDiagnostic(key, written, shipped, scope);
    return [{ path: key.split('.'), message: problem }];
}

function keyProblems(
    surface: KnownSettings,
    table: Partial<Policy>,
    scope: string | undefined,
    key: string,
    requireReasons: boolean,
): PolicyProblem[] {
    const match = specFor(surface, key);
    if (!match) return [{ path: key.split('.'), message: unknownSettingDiagnostic(surface, key) }];
    const written = policyValue(table, key);
    if (!written) return [];
    const validated = settingValueSchema(match.spec).safeParse(written.value);
    if (!validated.success)
        return [
            {
                path: key.split('.'),
                message: `The setting ${key}: ${validated.error.issues.map((issue) => issue.message).join('; ')}`,
            },
        ];
    if (match.spec.type === 'list')
        return listProblems(key, written, match, requireReasons, surface.defaults.get(match.spec.name)?.value);
    return requireReasons ? scalarProblems(surface, key, written, match, scope) : [];
}

function extraDuplicateProblems(surface: KnownSettings, table: Partial<Policy>): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    const { tools = {} } = table;
    for (const [tool, toolTable] of Object.entries(tools)) {
        const { verbatim = {} } = toolTable;
        for (const key of Object.keys(verbatim)) {
            if (key !== 'reason' && surface.specs.has(`tools.${tool}.${key}`))
                problems.push({
                    path: ['tools', tool, 'verbatim', key],
                    message: `\`${key}\` under [tools.${tool}.verbatim] already has a declared setting. Move it up to \`tools.${tool}.${key}\` and remove it from verbatim.`,
                });
        }
    }
    return problems;
}

// Configuration defaults that conflict in the root or a scope. No authored table settles them.
function unsettledConflicts(
    surface: KnownSettings,
    policy: Policy,
    scopeSurfaces: Map<string, KnownSettings>,
): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    const surfaces = [
        { settings: surface, scope: undefined, path: ['configurations'] as KeyPath },
        ...policy.scopes.map((scope, index) => ({
            settings: scopeSurfaces.get(scope.path) ?? surface,
            scope: scope.path,
            path: ['scope', index, 'configurations'] as KeyPath,
        })),
    ];
    for (const { settings, scope, path } of surfaces) {
        const layers = tablesFor(policy, scope);
        for (const { key, message: text } of settings.problems)
            if (!layers.some(({ table }) => policyValue(table, key) !== undefined))
                problems.push({ path, message: text });
    }
    return problems;
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
    if (surface.specs.has(key) || !isRecord(value)) return false;
    return [...surface.specs.keys()].some((name) => name.startsWith(`${key}.`));
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
    const known = [...surface.specs.keys()].filter((key) => policyValue(policy, key) !== undefined);
    return [...new Set([...known, ...limitKeys(policy), ...namingKeys(policy), ...keys, ...format])];
}

/**
 * Names unknown settings and lists the closest keys under the same table.
 * @param surface the known settings of the selected configurations.
 * @param key the authored setting key.
 * @returns the problem and a command for discovering settings.
 */
export function unknownSettingDiagnostic(surface: KnownSettings, key: string): string {
    const all = surface.specs.keys().toArray();
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
 * @returns the problems in plain English, empty when the policy is sound.
 */
export function validateAgainstSurface(
    surface: KnownSettings,
    policy: Policy,
    scopeSurfaces: Map<string, KnownSettings>,
    retained?: KnownSettings,
): PolicyProblem[] {
    const problems = unsettledConflicts(surface, policy, scopeSurfaces);
    // A root table feeds every scope, so it may hold a setting that only a configuration of some scope exposes.
    const later = [surface, ...scopeSurfaces.values(), ...(retained === undefined ? [] : [retained])].toReversed();
    const everywhere: KnownSettings = {
        specs: new Map(later.flatMap((entry) => entry.specs.entries().toArray())),
        defaults: new Map(later.flatMap((entry) => entry.defaults.entries().toArray())),
        problems: surface.problems,
    };
    for (const { table, scope, path } of everyTable(policy)) {
        const active = scope === undefined ? everywhere : (scopeSurfaces.get(scope) ?? surface);
        const settings: KnownSettings = {
            specs: new Map([...everywhere.specs, ...active.specs]),
            defaults: new Map([...everywhere.defaults, ...active.defaults]),
            problems: active.problems,
        };
        const found = [
            ...writtenKeys(table, settings).flatMap((key) =>
                keyProblems(settings, table, scope, key, policy.require_reasons),
            ),
            ...extraDuplicateProblems(settings, table),
        ];
        problems.push(...found.map((problem) => ({ ...problem, path: [...path, ...problem.path] })));
    }
    return problems;
}
