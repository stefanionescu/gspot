// The checks on a normalized policy that the schema cannot state: reasons present, selectors precise, scopes real.
import { join } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import * as messages from '#cli/policy/messages.ts';
import { toReasoned } from '#cli/policy/normalize.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import type { Policy, Reasoned, ToolTable } from '#types/config.ts';

const GLOB_CHARS = /[*?{}[\]!]/u;

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

function isBareDirectory(selector: string): boolean {
    const last = selector.split('/').pop() ?? selector;
    return !GLOB_CHARS.test(selector) && !last.includes('.') && !selector.endsWith('/');
}

function selectorProblems(selectors: string[], where: string): string[] {
    return selectors
        .filter((selector) => isBareDirectory(selector))
        .map((selector) => `${where}: ${messages.bareDirectory(selector)}`);
}

function ignoreProblems(policy: Policy): string[] {
    const problems: string[] = [];
    for (const [index, entry] of policy.ignores.entries()) {
        const where = `[[ignore]] entry ${String(index + 1)} (${entry.check})`;
        problems.push(
            ...present([needReason(where, entry.reason, `gspot ignore ${entry.check} --reason "..."`)]),
            ...selectorProblems(entry.paths ?? [], `[[ignore]] ${entry.check}`),
        );
    }
    return problems;
}

function declareProblems(policy: Policy): string[] {
    const problems: string[] = [];
    for (const [index, entry] of policy.declares.entries()) {
        const first = entry.paths[0] ?? '';
        problems.push(...selectorProblems(entry.paths, `[[declare]] entry ${String(index + 1)}`));
        if (entry.vendored === true) {
            const where = `[[declare]] entry ${String(index + 1)} (vendored)`;
            problems.push(
                ...present([needReason(where, entry.reason, `gspot declare ${first} --vendored --reason "..."`)]),
            );
        }
        const isExplained = entry.produced_by !== undefined || entry.vendored === true || entry.reason !== undefined;
        if (!isExplained)
            problems.push(messages.checkEntryIncomplete(`declare ${first}`, 'produced_by, vendored or reason'));
    }
    return problems;
}

function limitProblems(policy: Policy): string[] {
    const problems: (string | undefined)[] = [];
    for (const [key, value] of Object.entries(policy.limits.root))
        problems.push(reasonedProblem(`limits.${key}`, value));
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const [key, value] of Object.entries(table))
            problems.push(reasonedProblem(`limits.${group}.${key}`, value));
    return present(problems);
}

function namingProblems(policy: Policy): string[] {
    const problems: (string | undefined)[] = Array.from(policy.naming.allowed, (entry) =>
        needReason(`naming.allowed ${entry.name}`, entry.reason, `gspot allow naming ${entry.name} --reason "..."`),
    );
    for (const entry of policy.naming.remove_groups)
        problems.push(
            needReason(
                `naming.remove_groups ${entry.group}`,
                entry.reason,
                `gspot set naming.remove_groups ${entry.group} --reason "..."`,
            ),
        );
    for (const rule of policy.naming.rules) {
        problems.push(...selectorProblems(rule.paths, '[[naming.rules]]'));
        if (rule.exclude === true)
            problems.push(
                needReason(
                    `[[naming.rules]] excluding ${(rule.names ?? []).join(', ')}`,
                    rule.reason,
                    'add reason = "..."',
                ),
            );
    }
    for (const entry of policy.structure.call_through_allowed)
        problems.push(needReason(`structure.call_through_allowed ${entry.name}`, entry.reason, 'add reason = "..."'));
    return present(problems);
}

function isOff(option: unknown): boolean {
    return option === 'off' || (Array.isArray(option) && option[0] === 'off');
}

function enabledProblem(tool: string, table: ToolTable): string | undefined {
    if (table.enabled === undefined) return undefined;
    const enabled = toReasoned(table.enabled as boolean | { value: boolean; reason: string });
    if (enabled.value) return undefined;
    return needReason(
        `tools.${tool}.enabled = false`,
        enabled.reason,
        `gspot set tools.${tool}.enabled false --reason "..."`,
    );
}

function ruleOffProblems(tool: string, rules: unknown): string[] {
    const entries = typeof rules === 'object' && rules !== null ? Object.entries(rules as Record<string, unknown>) : [];
    return entries
        .filter(([, option]) => isOff(option))
        .map(([rule]) => messages.ruleOffRefused(`<check that runs ${tool}>`, rule));
}

function toolProblems(tool: string, table: ToolTable): string[] {
    const extra =
        table.extra !== undefined && !isReasonAccepted(table.extra.reason)
            ? messages.extraNeedsReason(tool)
            : undefined;
    return [...present([extra, enabledProblem(tool, table)]), ...ruleOffProblems(tool, table['rules'])];
}

function checkProblems(policy: Policy): string[] {
    const problems: string[] = [];
    for (const entry of policy.checks) {
        if (entry.paths.length === 0) problems.push(messages.checkEntryIncomplete(entry.name, 'paths'));
        problems.push(...selectorProblems(entry.paths, `[[check]] ${entry.name}`));
    }
    return problems;
}

/**
 * Every reason and selector problem in a policy: missing or placeholder reasons, bare directories, rules set to off.
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function reasonProblems(policy: Policy): string[] {
    const tools = Object.entries(policy.tools).flatMap(([tool, table]) => toolProblems(tool, table));
    return [
        ...ignoreProblems(policy),
        ...declareProblems(policy),
        ...limitProblems(policy),
        ...namingProblems(policy),
        ...tools,
        ...checkProblems(policy),
    ];
}

/**
 * Scopes that name a missing directory or sit inside another scope.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function scopeProblems(root: string, policy: Policy): string[] {
    const paths = policy.scopes.map((scope) => scope.path);
    const missing = paths.filter((path) => !isDirectory(join(root, path))).map((path) => messages.scopeMissing(path));
    const nested = paths.flatMap((outer) =>
        paths
            .filter((inner) => inner !== outer && inner.startsWith(`${outer}/`))
            .map((inner) => messages.scopesNest(outer, inner)),
    );
    return [...missing, ...nested];
}
