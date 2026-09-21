// Every written key checked against the surface: unknown keys, loosenings without a reason, extra keys with a slot.
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import { shippedPolicy } from '#cli/naming/policy.ts';
import { isLoosening, isReasonAccepted } from '#cli/policy/loosening.ts';
import type { WrittenValue, Policy, ExposedSettings } from '#types/config.ts';
import { asRecord, policyValue, specFor, writtenKeys } from '#cli/policy/settings.ts';

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

function listItemProblems(key: string, items: unknown, requireReasons: boolean): string[] {
    if (!Array.isArray(items)) return [];
    return (items as unknown[])
        .flatMap((item) => [requireReasons ? itemReasonProblem(key, item) : undefined, quotedTableProblem(key, item)])
        .filter((problem) => problem !== undefined);
}

function looseningProblem(
    key: string,
    written: WrittenValue,
    shipped: unknown,
    scope: string | undefined,
): string | undefined {
    if (written.reason !== undefined) return messages.refusedReason(key, written.reason);
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${scope}`;
    const value = JSON.stringify(written.value);
    return messages.loosenNeedsReason(key, value, shown, `gspot set ${key} ${value}${scopeFlag} --reason "..."`);
}

function keyProblems(
    surface: ExposedSettings,
    table: Partial<Policy>,
    scope: string | undefined,
    key: string,
    requireReasons: boolean,
): string[] {
    const match = specFor(surface, key);
    if (!match) return [unknownKeyProblem(surface, key)];
    const written = policyValue(table, key);
    if (!written) return [];
    if (match.spec.kind === 'list') {
        const problems = listItemProblems(key, written.value, requireReasons);
        if (requireReasons && match.spec.direction === 'loosening' && Array.isArray(written.value)) {
            for (const item of written.value as unknown[]) {
                const record = asRecord(item);
                if (record !== undefined && record['reason'] === undefined)
                    problems.push(messages.missingReason(key, `gspot set ${key} <entry> --reason "..."`));
            }
        }
        return problems;
    }
    const shipped = surface.defaults.get(match.spec.name)?.value;
    if (!requireReasons) return [];
    if (!isLoosening(match.spec, written.value, shipped) || isReasonAccepted(written.reason)) return [];
    const problem = looseningProblem(key, written, shipped, scope);
    return problem === undefined ? [] : [problem];
}

function extraProblems(surface: ExposedSettings, table: Partial<Policy>): string[] {
    const problems: string[] = [];
    const tools = table.tools ?? {};
    for (const [tool, toolTable] of Object.entries(tools)) {
        const extra = toolTable.extra ?? {};
        for (const key of Object.keys(extra)) {
            if (tool === 'prettier' && key === 'overrides')
                problems.push('Use [[format.overrides]] for path-specific formatter settings.');
            else if (key !== 'reason' && surface.specs.has(`tools.${tool}.${key}`))
                problems.push(messages.extraCoversSlot(tool, key));
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
): string[] {
    const keys = writtenKeys(table).flatMap((key) => keyProblems(surface, table, scope, key, requireReasons));
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
): string[] {
    const problems = [...surface.problems];
    // A root table feeds every scope, so it may hold a setting that only a preset of some scope exposes.
    const everywhere = mergedSurface([surface, ...scopeSurfaces.values()]);
    const surfaceFor = (scope: string | undefined): ExposedSettings =>
        scope === undefined ? everywhere : (scopeSurfaces.get(scope) ?? surface);
    const tables: { table: Partial<Policy>; scope?: string }[] = [
        { table: policy },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ table, scope })),
    ];
    for (const { table, scope } of tables)
        problems.push(...tableProblems(surfaceFor(scope), table, scope, policy.requireReasons));
    for (const { group } of policy.naming.remove_groups)
        if (shippedPolicy().groups[group]?.removable === false) problems.push(messages.groupNotRemovable(group));
    return problems;
}
