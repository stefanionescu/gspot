import { quoteArgument } from '#cli/run/reproduce.ts';
// The checks on a normalized policy that the schema cannot state: reasons present, selectors precise, scopes real.
import { mutationPath, openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import * as messages from '#cli/policy/messages.ts';
import type {
    EditorconfigAdoption,
    EslintAdoption,
    PathSegment,
    Policy,
    PolicyProblem,
    Reasoned,
    ToolTable,
} from '#cli/policy/types.ts';

function needReason(where: string, reason: string | undefined, command: string): string | undefined {
    if (reason === undefined) return messages.missingReason(where, command);
    return isReasonAccepted(reason) ? undefined : messages.refusedReason(where, reason);
}

function reasonedProblem(where: string, value: Reasoned<unknown> | undefined): string | undefined {
    if (value?.reason === undefined || isReasonAccepted(value.reason)) return undefined;
    return messages.refusedReason(where, value.reason);
}

function located(path: PathSegment[], message: string | undefined): PolicyProblem[] {
    return message === undefined ? [] : [{ path, message }];
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
    return ['generated', 'vendored'].flatMap((nature) =>
        policy.declarations
            .filter((entry) => entry.nature === nature)
            .flatMap((entry, index) => {
                const where = `[[${entry.nature}]] ${entry.paths.join(', ')}`;
                return located(
                    [nature, index, 'reason'],
                    needReason(
                        where,
                        entry.reason,
                        `gspot set ${entry.nature} ${quoteArgument(entry.paths[0]!)} --reason "..."`,
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
    const explanation = (where: string, reason: string | undefined, command: string): string | undefined =>
        policy.requireReasons ? needReason(where, reason, command) : undefined;
    const problems = policy.naming.allowed.flatMap((entry, index) =>
        located(
            ['naming', 'allowed', index, 'reason'],
            explanation(
                `naming.allowed ${entry.name}`,
                entry.reason,
                `gspot set naming.allowed ${quoteArgument(JSON.stringify({ name: entry.name }))} --reason "..."`,
            ),
        ),
    );
    for (const [index, entry] of policy.naming.remove_groups.entries())
        problems.push(
            ...located(
                ['naming', 'remove_groups', index, 'reason'],
                explanation(
                    `naming.remove_groups ${entry.group}`,
                    entry.reason,
                    `gspot set naming.remove_groups ${quoteArgument(JSON.stringify({ group: entry.group }))} --reason "..."`,
                ),
            ),
        );
    for (const [index, rule] of policy.naming.rules.entries()) {
        if (rule.exclude === true)
            problems.push(
                ...located(
                    ['naming', 'rules', index, 'reason'],
                    explanation(
                        `[[naming.rules]] excluding ${(rule.names ?? []).join(', ')}`,
                        rule.reason,
                        'add reason = "..."',
                    ),
                ),
            );
    }
    return problems;
}

function isOff(option: unknown): boolean {
    const severity = Array.isArray(option) ? option[0] : option;
    return severity === 'off' || severity === 0;
}

function ruleOffProblems(tool: string, rules: unknown, path: PathSegment[]): PolicyProblem[] {
    const entries = typeof rules === 'object' && rules !== null ? Object.entries(rules as Record<string, unknown>) : [];
    return entries
        .filter(([, option]) => isOff(option))
        .map(([rule]) => ({
            path: [...path, 'rules', rule],
            message: messages.ruleOffRefused(`<check that runs ${tool}>`, rule),
        }));
}

function toolProblems(tool: string, table: ToolTable, requireReasons: boolean, path: PathSegment[]): PolicyProblem[] {
    const extra =
        requireReasons && table.extra !== undefined && !isReasonAccepted(table.extra.reason)
            ? messages.extraNeedsReason(tool)
            : undefined;
    // Stylelint uses zero as an enabled numeric limit. Its schema rejects disabled primary options.
    return [
        ...located([...path, 'extra', 'reason'], extra),
        ...(tool === 'stylelint' ? [] : ruleOffProblems(tool, table['rules'], path)),
    ];
}

function checkProblems(policy: Policy): PolicyProblem[] {
    const problems: PolicyProblem[] = [];
    for (const [index, entry] of policy.checks.entries()) {
        if (entry.paths.length === 0)
            problems.push({
                path: ['check', index, 'paths'],
                message: messages.checkEntryIncomplete(entry.name, 'paths'),
            });
    }
    return problems;
}

function policyLayers(policy: Policy): { scope: Partial<Policy>; path: PathSegment[] }[] {
    return [
        { scope: policy, path: [] },
        ...policy.scopes.flatMap((scope, index) => {
            const table = policy.scopeTables[scope.path];
            return table === undefined ? [] : [{ scope: table, path: ['scope', index] as PathSegment[] }];
        }),
    ];
}

/**
 * Every reason and selector problem in a policy: missing or placeholder reasons, bare directories, rules set to off.
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function reasonProblems(policy: Policy): PolicyProblem[] {
    const tools = policyLayers(policy).flatMap(({ scope, path }) =>
        Object.entries(scope.tools ?? {}).flatMap(([tool, table]) =>
            toolProblems(tool, table, policy.requireReasons, [...path, 'tools', tool]),
        ),
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
 * Validate scope directories and repository-owned ESLint selector and executable paths.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function pathProblems(root: string, policy: Policy): PolicyProblem[] {
    const paths = policy.scopes.map((scope) => scope.path);
    const files = openConfinedRoot(root);
    const missing: PolicyProblem[] = [];
    for (const [index, path] of paths.entries()) {
        const location: PathSegment[] = ['scope', index, 'path'];
        try {
            if (files.stat(path)?.isDirectory() !== true)
                missing.push({ path: location, message: messages.scopeMissing(path) });
        } catch (error) {
            missing.push({ path: location, message: String(error) });
        }
    }
    const seen = new Set<string>();
    const duplicates: PolicyProblem[] = [];
    for (const [index, path] of paths.entries()) {
        const key = path.normalize('NFC').toLowerCase();
        if (seen.has(key))
            duplicates.push({
                path: ['scope', index, 'path'],
                message: `Scope path is declared more than once: ${path}.`,
            });
        seen.add(key);
    }
    const configuration: PolicyProblem[] = [];
    for (const { scope, path } of policyLayers(policy)) {
        const editorconfig = scope.tools?.['editorconfig']?.['adopted'] as EditorconfigAdoption | undefined;
        for (const [index, directory] of (editorconfig?.directories ?? []).entries()) {
            const location = [...path, 'tools', 'editorconfig', 'adopted', 'directories', index, 'basePath'];
            try {
                mutationPath(directory.basePath);
                const observed = files.stat(directory.basePath);
                if (observed !== undefined && !observed.isDirectory())
                    configuration.push({
                        path: location,
                        message: `EditorConfig basePath is not a directory: ${directory.basePath}`,
                    });
            } catch (error) {
                configuration.push({ path: location, message: String(error) });
            }
        }
        const adopted = (scope.tools?.['eslint']?.['adopted'] ?? []) as EslintAdoption[];
        for (const [index, entry] of adopted.entries()) {
            const location = [...path, 'tools', 'eslint', 'adopted', index];
            let sourcePath = location;
            try {
                const bases = [
                    { value: entry.basePath, path: ['basePath'] },
                    { value: entry.legacyCriteria?.basePath, path: ['legacyCriteria', 'basePath'] },
                    { value: entry.legacyScope?.basePath, path: ['legacyScope', 'basePath'] },
                    ...(entry.legacyIgnores ?? []).flatMap((ignore, index) => [
                        { value: ignore.basePath, path: ['legacyIgnores', index, 'basePath'] },
                        { value: ignore.criteria?.basePath, path: ['legacyIgnores', index, 'criteria', 'basePath'] },
                    ]),
                ];
                for (const { value: base, path: relativePath } of bases) {
                    if (base === undefined || base === '.') continue;
                    sourcePath = [...location, ...relativePath];
                    mutationPath(base);
                    const directory = files.stat(base);
                    if (directory !== undefined && !directory.isDirectory())
                        configuration.push({
                            path: sourcePath,
                            message: `ESLint basePath is not a directory: ${base}`,
                        });
                }
                const references = [
                    ...Object.entries(entry.plugins ?? {}).map(([name, reference]) => ({
                        reference,
                        path: ['plugins', name, 'module'],
                    })),
                    ...(entry.languageOptions?.parser === undefined
                        ? []
                        : [{ reference: entry.languageOptions.parser, path: ['languageOptions', 'parser', 'module'] }]),
                    ...(typeof entry.processor === 'object'
                        ? [{ reference: entry.processor, path: ['processor', 'module'] }]
                        : []),
                ];
                for (const { reference, path: relativePath } of references) {
                    sourcePath = [...location, ...relativePath];
                    if (reference.module.startsWith('./')) {
                        if (files.read(reference.module.slice(2)) === undefined)
                            configuration.push({
                                path: sourcePath,
                                message: `ESLint executable module is missing: ${reference.module}`,
                            });
                    } else if (/^(?:\.|\/|\\|[A-Za-z]:)/u.test(reference.module)) {
                        configuration.push({
                            path: sourcePath,
                            message: `ESLint executable module must belong to the repository: ${reference.module}`,
                        });
                    }
                }
            } catch (error) {
                configuration.push({ path: sourcePath, message: String(error) });
            }
        }
    }
    files.close();
    return [...missing, ...duplicates, ...configuration];
}
