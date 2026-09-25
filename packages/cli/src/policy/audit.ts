import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import { shippedPolicy } from '#cli/checks/naming/policy.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import { settingValueSchemas } from '#cli/policy/schema.ts';
import { isLoosening, isReasonAccepted } from '#cli/policy/loosening.ts';
import type { PathSegment, PolicyProblem } from '#cli/policy/problems.ts';
import type { ExposedSettings, WrittenValue } from '#cli/policy/settings.ts';
import { asRecord, policyTables, policyValue, specFor, writtenKeys } from '#cli/policy/settings.ts';

const LIMITS_PREFIX = 'limits.';

function unknownKeyProblem(surface: ExposedSettings, key: string): string {
    const all = surface.specs.keys().toArray();
    if (key.startsWith(LIMITS_PREFIX)) {
        const limits = all.filter((candidate) => candidate.startsWith(LIMITS_PREFIX));
        return messages.limitUnknown(
            key,
            limits.map((candidate) => candidate.slice(LIMITS_PREFIX.length)),
        );
    }
    const depth = key.startsWith('tools.') ? 2 : 1;
    const prefix = key.split('.').slice(0, depth).join('.');
    const known = all
        .filter((candidate) => candidate.startsWith(`${prefix}.`))
        .map((candidate) => candidate.slice(prefix.length + 1));
    const near = nearMatches(key.slice(prefix.length + 1), known);
    const rest = known.filter((item) => !near.includes(item));
    return messages.settingNotExposed(key, known.length > 0 ? [...near, ...rest] : []);
}

function itemReasonProblem(key: string, item: unknown): string | undefined {
    const record = asRecord(item);
    if (!record || !('reason' in record)) return undefined;
    const reason = String(record['reason']);
    if (key === 'tools.typos.words' && reason === record['word']) return undefined;
    return isReasonAccepted(reason) ? undefined : messages.refusedReason(key, reason);
}

// A table typed inside quotes is one string to TOML, and nothing reads a string where a table belongs.
function quotedTableProblem(key: string, item: unknown): string | undefined {
    const text = typeof item === 'string' ? item.trim() : '';
    const isQuoted = (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[{') && text.endsWith('}]'));
    return isQuoted ? messages.quotedTable(key, text) : undefined;
}

function listItemProblems(key: string, items: unknown, requireReasons: boolean): PolicyProblem[] {
    if (!Array.isArray(items)) return [];
    return (items as unknown[]).flatMap((item, index) => {
        const reason = requireReasons ? itemReasonProblem(key, item) : undefined;
        const quoted = quotedTableProblem(key, item);
        return [
            ...(reason === undefined ? [] : [{ path: [...key.split('.'), index, 'reason'], message: reason }]),
            ...(quoted === undefined ? [] : [{ path: [...key.split('.'), index], message: quoted }]),
        ];
    });
}

function looseningProblem(
    key: string,
    written: WrittenValue,
    shipped: unknown,
    scope: string | undefined,
): string | undefined {
    if (written.reason !== undefined) return messages.refusedReason(key, written.reason);
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = JSON.stringify(written.value);
    return messages.loosenNeedsReason(
        key,
        value,
        shown,
        `gspot set ${quoteArgument(key)} ${quoteArgument(value)}${scopeFlag} --reason "..."`,
    );
}

function keyProblems(
    surface: ExposedSettings,
    table: Partial<Policy>,
    scope: string | undefined,
    key: string,
    requireReasons: boolean,
): PolicyProblem[] {
    const match = specFor(surface, key);
    if (!match) return [{ path: key.split('.'), message: unknownKeyProblem(surface, key) }];
    const written = policyValue(table, key);
    if (!written) return [];
    if (!settingValueSchemas[match.spec.kind].safeParse(written.value).success)
        return [{ path: key.split('.'), message: `The setting ${key} requires a ${match.spec.kind} value.` }];
    if (match.spec.kind === 'list') {
        const problems = listItemProblems(key, written.value, requireReasons);
        if (requireReasons && match.spec.direction === 'loosening' && Array.isArray(written.value)) {
            for (const [index, item] of (written.value as unknown[]).entries()) {
                const record = asRecord(item);
                if (record !== undefined && record['reason'] === undefined)
                    problems.push({
                        path: [...key.split('.'), index],
                        message: messages.missingReason(key, `gspot set ${quoteArgument(key)} <entry> --reason "..."`),
                    });
            }
        }
        return problems;
    }
    const shipped = surface.defaults.get(match.spec.name)?.value;
    if (!requireReasons) return [];
    if (!isLoosening(match.spec, written.value, shipped) || isReasonAccepted(written.reason)) return [];
    const problem = looseningProblem(key, written, shipped, scope);
    return problem === undefined ? [] : [{ path: key.split('.'), message: problem }];
}

function extraProblems(surface: ExposedSettings, table: Partial<Policy>): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    const tools = table.tools ?? {};
    for (const [tool, toolTable] of Object.entries(tools)) {
        const extra = toolTable.extra ?? {};
        for (const key of Object.keys(extra)) {
            if (key !== 'reason' && surface.specs.has(`tools.${tool}.${key}`))
                problems.push({ path: ['tools', tool, 'extra', key], message: messages.extraCoversSlot(tool, key) });
        }
    }
    return problems;
}

// The first surface wins a key two surfaces share, so the root keeps its own default.
function mergedSurface(surfaces: ExposedSettings[]): ExposedSettings {
    const later = surfaces.toReversed();
    return {
        specs: new Map(later.flatMap((surface) => surface.specs.entries().toArray())),
        defaults: new Map(later.flatMap((surface) => surface.defaults.entries().toArray())),
        problems: surfaces[0]?.problems ?? [],
    };
}

function tableProblems(
    surface: ExposedSettings,
    table: Partial<Policy>,
    scope: string | undefined,
    requireReasons: boolean,
): PolicyProblem[] {
    const keys = writtenKeys(table, surface).flatMap((key) => keyProblems(surface, table, scope, key, requireReasons));
    return [...keys, ...extraProblems(surface, table)];
}

/**
 * Validates every written key against the surface and the loosening rule.
 * @param surface the surface of the selection
 * @param policy the loaded policy
 * @param scopeSurfaces the surface of each scope by its path; a scope table is read against its own
 * @returns the problems in plain English, empty when the policy is sound
 */
export function validateAgainstSurface(
    surface: ExposedSettings,
    policy: Policy,
    scopeSurfaces = new Map<string, ExposedSettings>(),
): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    for (const { settings, scope, path } of [
        { settings: surface, scope: undefined, path: ['configurations'] },
        ...policy.scopes.map((scope, index) => ({
            settings: scopeSurfaces.get(scope.path) ?? surface,
            scope: scope.path,
            path: ['scope', index, 'configurations'],
        })),
    ]) {
        const layers = policyTables(policy, scope);
        for (const { key, message } of settings.problems)
            if (!layers.some(({ table }) => policyValue(table, key) !== undefined)) problems.push({ path, message });
    }
    // A root table feeds every scope, so it may hold a setting that only a configuration of some scope exposes.
    const everywhere = mergedSurface([surface, ...scopeSurfaces.values()]);
    const tables: { table: Partial<Policy>; scope?: string; path: PathSegment[] }[] = [
        { table: policy, path: [] },
        ...policy.scopes.flatMap((scope, index) => {
            const table = policy.scopeTables[scope.path];
            return table === undefined ? [] : [{ table, scope: scope.path, path: ['scope', index] as PathSegment[] }];
        }),
    ];
    for (const { table, scope, path } of tables)
        problems.push(
            ...tableProblems(
                scope === undefined ? everywhere : (scopeSurfaces.get(scope) ?? surface),
                table,
                scope,
                policy.requireReasons,
            ).map((problem) => ({
                ...problem,
                path: [...path, ...problem.path],
            })),
        );
    for (const [index, { group }] of policy.naming.remove_groups.entries())
        if (shippedPolicy().groups[group]?.removable === false)
            problems.push({
                path: ['naming', 'remove_groups', index, 'group'],
                message: messages.groupNotRemovable(group),
            });
    return problems;
}
