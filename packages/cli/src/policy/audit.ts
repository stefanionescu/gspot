// Every written key checked against the surface: unknown keys, loosenings without a reason, extra keys with a slot.
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
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

function listItemProblems(key: string, items: unknown): string[] {
    if (!Array.isArray(items)) return [];
    return (items as unknown[]).map((item) => itemReasonProblem(key, item)).filter((problem) => problem !== undefined);
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
): string[] {
    const match = specFor(surface, key);
    if (!match) return [unknownKeyProblem(surface, key)];
    const written = policyValue(table, key);
    if (!written) return [];
    if (match.spec.kind === 'list') return listItemProblems(key, written.value);
    const shipped = surface.defaults.get(match.spec.name)?.value;
    if (!isLoosening(match.spec, written.value, shipped) || isReasonAccepted(written.reason)) return [];
    const problem = looseningProblem(key, written, shipped, scope);
    return problem === undefined ? [] : [problem];
}

function extraProblems(surface: ExposedSettings, table: Partial<Policy>): string[] {
    const problems: string[] = [];
    const tools = table.tools ?? {};
    for (const [tool, toolTable] of Object.entries(tools)) {
        const extra = toolTable.extra ?? {};
        for (const key of Object.keys(extra))
            if (key !== 'reason' && surface.specs.has(`tools.${tool}.${key}`))
                problems.push(messages.extraCoversSlot(tool, key));
    }
    return problems;
}

/**
 * Validates every written key against the surface and the loosening rule.
 * @param surface the surface of the selection
 * @param policy the loaded policy
 * @returns the problems in plain English, empty when the policy is sound
 */
export function validateAgainstSurface(surface: ExposedSettings, policy: Policy): string[] {
    const problems = [...surface.problems];
    const tables: { table: Partial<Policy>; scope?: string }[] = [
        { table: policy },
        ...Object.entries(policy.scopeTables).map(([scope, table]) => ({ table, scope })),
    ];
    for (const { table, scope } of tables) {
        for (const key of writtenKeys(table)) problems.push(...keyProblems(surface, table, scope, key));
        problems.push(...extraProblems(surface, table));
    }
    for (const { group } of policy.naming.remove_groups)
        if (group === 'marketing' || group === 'defensive') problems.push(messages.groupNotRemovable(group));
    return problems;
}
