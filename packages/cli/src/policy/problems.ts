// The problems a policy has beyond its schema: missing or placeholder reasons, and scope paths that do not exist.
import * as messages from '#cli/policy/messages.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import type { Policy, Reasoned, ToolTable, PathSegment, PolicyProblem } from '#cli/types/policy/policy.ts';

function needReason(where: string, reason: string | undefined, command: string): string | undefined {
    if (reason === undefined) return messages.missingReason(where, command);
    return isReasonAccepted(reason) ? undefined : messages.refusedReason(where, reason);
}

function reasonedProblem(where: string, value: Reasoned<unknown> | undefined): string | undefined {
    if (value?.reason === undefined || isReasonAccepted(value.reason)) return undefined;
    return messages.refusedReason(where, value.reason);
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Eight validators turn an optional message into a located problem; one owner keeps the shape.
function located(path: PathSegment[], text: string | undefined): PolicyProblem[] {
    return text === undefined ? [] : [{ path, message: text }];
}

function ignoreProblems(policy: Policy): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    for (const [index, entry] of policy.ignores.entries()) {
        const where = `[[ignore]] entry ${String(index + 1)} (${entry.check})`;
        problems.push(
            ...located(
                ['ignore', index, 'reason'],
                policy.requireReasons
                    ? needReason(where, entry.reason, `gspot ignore ${quoteArgument(entry.check)} --reason "..."`)
                    : undefined,
            ),
        );
    }
    return problems;
}

function declarationProblems(policy: Policy): PolicyProblem[] {
    if (!policy.requireReasons) return [];
    return ['generated', 'vendored'].flatMap((kind) =>
        policy.declarations
            .filter((entry) => entry.kind === kind)
            .flatMap((entry, index) => {
                const where = `[[${entry.kind}]] ${entry.paths.join(', ')}`;
                const [firstPath = ''] = entry.paths;
                return located(
                    [kind, index, 'reason'],
                    needReason(
                        where,
                        entry.reason,
                        `gspot set ${entry.kind} ${quoteArgument(firstPath)} --reason "..."`,
                    ),
                );
            }),
    );
}

function limitProblems(policy: Policy): PolicyProblem[] {
    if (!policy.requireReasons) return [];
    const problems: PolicyProblem[] = [];
    for (const [key, value] of Object.entries(policy.limits.root))
        problems.push(...located(['limits', key, 'reason'], reasonedProblem(`limits.${key}`, value)));
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const [key, value] of Object.entries(table))
            problems.push(
                ...located(['limits', group, key, 'reason'], reasonedProblem(`limits.${group}.${key}`, value)),
            );
    return problems;
}

function namingProblems(policy: Policy): PolicyProblem[] {
    if (!policy.requireReasons) return [];
    const allowed = policy.naming.allowed.flatMap((entry, index) => {
        const text = needReason(
            `naming.allowed ${entry.name}`,
            entry.reason,
            `gspot set naming.allowed ${quoteArgument(JSON.stringify({ name: entry.name }))} --reason "..."`,
        );
        return located(['naming', 'allowed', index, 'reason'], text);
    });
    const removed = policy.naming.dropped_groups.flatMap((entry, index) => {
        const where = `naming.dropped_groups ${entry.group}`;
        const text = needReason(
            where,
            entry.reason,
            `gspot set naming.dropped_groups ${quoteArgument(JSON.stringify({ group: entry.group }))} --reason "..."`,
        );
        return located(['naming', 'dropped_groups', index, 'reason'], text);
    });
    const excluded = policy.naming.rules.flatMap((rule, index) => {
        if (rule.exclude !== true) return [];
        const where = `[[naming.rules]] excluding ${(rule.names ?? []).join(', ')}`;
        return located(['naming', 'rules', index, 'reason'], needReason(where, rule.reason, 'add reason = "..."'));
    });
    return [...allowed, ...removed, ...excluded];
}

function toolProblems(tool: string, table: ToolTable, requireReasons: boolean, path: PathSegment[]): PolicyProblem[] {
    const extra =
        requireReasons && table.extra !== undefined && !isReasonAccepted(table.extra.reason)
            ? messages.extraNeedsReason(tool)
            : undefined;
    const rules = table['rules'];
    const entries = typeof rules === 'object' && rules !== null ? Object.entries(rules as Record<string, unknown>) : [];
    const disabled = entries
        .filter(([, option]) => {
            const severity: unknown = Array.isArray(option) ? option[0] : option;
            return severity === 'off' || severity === 0;
        })
        .map(([rule]) => ({
            path: [...path, 'rules', rule],
            message: messages.ruleOffRefused(`<check that runs ${tool}>`, rule),
        }));
    // Stylelint uses zero as an enabled numeric limit. Its schema rejects disabled primary options.
    return [...located([...path, 'extra', 'reason'], extra), ...(tool === 'stylelint' ? [] : disabled)];
}

// The problems a reader finds, or the error it threw, attributed to the policy value being read.
function guarded(location: PathSegment[], read: () => PolicyProblem[]): PolicyProblem[] {
    try {
        return read();
    } catch (error) {
        return [{ path: location, message: String(error) }];
    }
}

// Duplicate scope declarations after case and Unicode normalization.
function duplicateScopeProblems(paths: string[]): PolicyProblem[] {
    const seen = new Set<string>();
    const problems: PolicyProblem[] = [];
    for (const [index, path] of paths.entries()) {
        const key = path.normalize('NFC').toLowerCase();
        if (seen.has(key))
            problems.push({
                path: ['scope', index, 'path'],
                message: `Scope path is declared more than once: ${path}.`,
            });
        seen.add(key);
    }
    return problems;
}

/**
 * The root policy and each scope table, with where each one sits in the document.
 * @param policy the normalized policy
 * @returns the layers, root first
 */
export function policyLayers(policy: Policy): { table: Partial<Policy>; scope?: string; path: PathSegment[] }[] {
    return [
        { table: policy, path: [] },
        ...policy.scopes.flatMap((scope, index) => {
            const table = policy.scopeTables[scope.path];
            return table === undefined ? [] : [{ table, scope: scope.path, path: ['scope', index] as PathSegment[] }];
        }),
    ];
}

/**
 * Every reason and selector problem in a policy: missing or placeholder reasons, bare directories, rules set to off.
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function reasonProblems(policy: Policy): PolicyProblem[] {
    const tools = policyLayers(policy).flatMap(({ table: layer, path }) =>
        Object.entries(layer.tools ?? {}).flatMap(([tool, table]) =>
            toolProblems(tool, table, policy.requireReasons, [...path, 'tools', tool]),
        ),
    );
    return [
        ...ignoreProblems(policy),
        ...declarationProblems(policy),
        ...limitProblems(policy),
        ...namingProblems(policy),
        ...tools,
        ...policy.checks.flatMap((entry, index) => {
            if (entry.paths.length > 0) return [];
            return [{ path: ['check', index, 'paths'], message: messages.checkEntryIncomplete(entry.name, 'paths') }];
        }),
    ];
}

/**
 * Validate that every scope names a directory of the repository, once.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function pathProblems(root: string, policy: Policy): PolicyProblem[] {
    const paths = policy.scopes.map((scope) => scope.path);
    using files = openRoot(root);
    const missing = paths.flatMap((path, index) => {
        const location: PathSegment[] = ['scope', index, 'path'];
        return guarded(location, () =>
            files.stat(path)?.isDirectory() === true ? [] : [{ path: location, message: messages.scopeMissing(path) }],
        );
    });
    return [...missing, ...duplicateScopeProblems(paths)];
}
