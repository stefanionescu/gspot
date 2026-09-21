// The checks on a normalized policy that the schema cannot state: reasons present, selectors precise, scopes real.
import { join } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import * as messages from '#cli/policy/messages.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import type { Policy, Reasoned, ToolTable } from '#types/config.ts';

function needReason(where: string, reason: string | undefined, command: string): string | undefined {
    if (reason === undefined) return messages.missingReason(where, command);
    return isReasonAccepted(reason) ? undefined : messages.refusedReason(where, reason);
}

function reasonedProblem(where: string, value: Reasoned<unknown> | undefined): string | undefined {
    if (value?.reason === undefined || isReasonAccepted(value.reason)) return undefined;
    return messages.refusedReason(where, value.reason);
}

function present(problems: (string | undefined)[]): string[] {
    return problems.filter((problem) => problem !== undefined);
}

function isDirectory(full: string): boolean {
    return existsSync(full) && statSync(full).isDirectory();
}

function ignoreProblems(policy: Policy): string[] {
    const problems: string[] = [];
    for (const [index, entry] of policy.ignores.entries()) {
        const where = `[[ignore]] entry ${String(index + 1)} (${entry.check})`;
        problems.push(
            ...present([
                policy.requireReasons
                    ? needReason(where, entry.reason, `gspot ignore ${entry.check} --reason "..."`)
                    : undefined,
            ]),
        );
    }
    return problems;
}

function declarationProblems(policy: Policy): string[] {
    return present(
        policy.declarations.map((entry) => {
            if (!policy.requireReasons) return undefined;
            const where = `[[${entry.nature}]] ${entry.paths.join(', ')}`;
            return needReason(where, entry.reason, `gspot set ${entry.nature} "${entry.paths[0]}" --reason "..."`);
        }),
    );
}

function limitProblems(policy: Policy): string[] {
    if (!policy.requireReasons) return [];
    const problems: (string | undefined)[] = [];
    for (const [key, value] of Object.entries(policy.limits.root))
        problems.push(reasonedProblem(`limits.${key}`, value));
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const [key, value] of Object.entries(table))
            problems.push(reasonedProblem(`limits.${group}.${key}`, value));
    return present(problems);
}

function namingProblems(policy: Policy): string[] {
    const explanation = (where: string, reason: string | undefined, command: string): string | undefined =>
        policy.requireReasons ? needReason(where, reason, command) : undefined;
    const problems: (string | undefined)[] = Array.from(policy.naming.allowed, (entry) =>
        explanation(
            `naming.allowed ${entry.name}`,
            entry.reason,
            `gspot set naming.allowed '${JSON.stringify({ name: entry.name })}' --reason "..."`,
        ),
    );
    for (const entry of policy.naming.remove_groups)
        problems.push(
            explanation(
                `naming.remove_groups ${entry.group}`,
                entry.reason,
                `gspot set naming.remove_groups ${entry.group} --reason "..."`,
            ),
        );
    for (const rule of policy.naming.rules) {
        if (rule.exclude === true)
            problems.push(
                explanation(
                    `[[naming.rules]] excluding ${(rule.names ?? []).join(', ')}`,
                    rule.reason,
                    'add reason = "..."',
                ),
            );
    }
    for (const entry of policy.structure.call_through_allowed)
        problems.push(explanation(`structure.call_through_allowed ${entry.name}`, entry.reason, 'add reason = "..."'));
    return present(problems);
}

function isOff(option: unknown): boolean {
    const severity = Array.isArray(option) ? option[0] : option;
    return severity === 'off' || severity === 0;
}

function ruleOffProblems(tool: string, rules: unknown): string[] {
    const entries = typeof rules === 'object' && rules !== null ? Object.entries(rules as Record<string, unknown>) : [];
    return entries
        .filter(([, option]) => isOff(option))
        .map(([rule]) => messages.ruleOffRefused(`<check that runs ${tool}>`, rule));
}

function toolProblems(tool: string, table: ToolTable, requireReasons: boolean): string[] {
    const extra =
        requireReasons && table.extra !== undefined && !isReasonAccepted(table.extra.reason)
            ? messages.extraNeedsReason(tool)
            : undefined;
    return [...present([extra]), ...ruleOffProblems(tool, table['rules'])];
}

function checkProblems(policy: Policy): string[] {
    const problems: string[] = [];
    for (const entry of policy.checks) {
        if (entry.paths.length === 0) problems.push(messages.checkEntryIncomplete(entry.name, 'paths'));
    }
    return problems;
}

/**
 * Every reason and selector problem in a policy: missing or placeholder reasons, bare directories, rules set to off.
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function reasonProblems(policy: Policy): string[] {
    const tools = [policy, ...Object.values(policy.scopeTables)].flatMap((scope) =>
        Object.entries(scope.tools ?? {}).flatMap(([tool, table]) => toolProblems(tool, table, policy.requireReasons)),
    );
    return [
        ...ignoreProblems(policy),
        ...declarationProblems(policy),
        ...limitProblems(policy),
        ...namingProblems(policy),
        ...tools,
        ...checkProblems(policy),
    ];
}

/**
 * Scopes that name a missing directory or repeat the same path.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function scopeProblems(root: string, policy: Policy): string[] {
    const paths = policy.scopes.map((scope) => scope.path);
    const missing = paths.filter((path) => !isDirectory(join(root, path))).map((path) => messages.scopeMissing(path));
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const path of paths) {
        const key = path.normalize('NFC').toLowerCase();
        if (seen.has(key)) duplicates.push(`Scope path is declared more than once: ${path}.`);
        seen.add(key);
    }
    return [...missing, ...duplicates];
}
