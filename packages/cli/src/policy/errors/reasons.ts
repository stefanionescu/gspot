// Exception reasons, unconditional policy restrictions, and declared scope paths.
import { isDeepStrictEqual } from 'node:util';
import { pathKey } from '#cli/platform/paths.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import { everyTable } from '#cli/policy/settings/lookup.ts';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { SettingSpec } from '#cli/types/configurations.ts';
import { allChecks } from '#cli/configurations/declarations.ts';
import { REASON_WORDS_MIN } from '#cli/config/policy/settings.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { Policy, ToolTable, PolicyProblem } from '#cli/types/policy/settings.ts';

function located(path: KeyPath, text: string | undefined): PolicyProblem[] {
    return text === undefined ? [] : [{ path, message: text }];
}

function ignoreProblems(policy: Policy): PolicyProblem[] {
    if (!policy.require_reasons) return [];
    const problems: PolicyProblem[] = [];
    for (const [index, entry] of policy.ignores.entries()) {
        const where = `[[ignore]] (${entry.check})`;
        problems.push(...located(['ignore', index, 'reason'], reasonDiagnostic(where, entry.reason)));
    }
    return problems;
}

function declarationProblems(policy: Policy): PolicyProblem[] {
    if (!policy.require_reasons) return [];
    return ['generated', 'vendored'].flatMap((kind) =>
        policy.declarations
            .filter((entry) => entry.kind === kind)
            .flatMap((entry, index) => {
                const where = `[[${entry.kind}]] ${entry.paths.join(', ')}`;
                return located([kind, index, 'reason'], reasonDiagnostic(where, entry.reason));
            }),
    );
}

function namingPathProblems(policy: Policy): PolicyProblem[] {
    if (!policy.require_reasons) return [];
    return policy.naming.paths.flatMap((rule, index) => {
        if (rule.skip !== true) return [];
        const where = `[[naming.paths]] excluding ${(rule.names ?? []).join(', ')}`;
        return located(['naming', 'paths', index, 'reason'], reasonDiagnostic(where, rule.reason));
    });
}

function toolReasonProblems(tool: string, table: ToolTable, requireReasons: boolean, path: KeyPath): PolicyProblem[] {
    if (!requireReasons || table.verbatim === undefined || isReasonAccepted(table.verbatim.reason)) return [];
    return [
        {
            path: [...path, 'verbatim', 'reason'],
            message: `[tools.${tool}.verbatim] needs a \`reason\` that names the option gspot has no setting for. The reason appears in \`gspot list settings\`.`,
        },
    ];
}

function disabledRuleProblems(tool: string, table: ToolTable, path: KeyPath): PolicyProblem[] {
    const rules = table['rules'];
    if (!isRecord(rules)) return [];
    const manifests = configurationManifests();
    const disabledOptions = [...manifests.values()]
        .flatMap((manifest) => manifest.settings)
        .find((spec) => spec.name === `tools.${tool}.rules`)?.off_values;
    if (disabledOptions === undefined) return [];
    const disabled = Object.entries(rules).filter(([, option]) => {
        const severity: unknown = Array.isArray(option) ? option[0] : option;
        return (
            (typeof severity === 'string' || typeof severity === 'number' || typeof severity === 'boolean') &&
            disabledOptions.includes(severity)
        );
    });
    if (disabled.length === 0) return [];
    // Tool settings use the public check name, which can differ from its executable.
    const check = [...allChecks(manifests.values()).values()].find(({ check }) =>
        check.name.endsWith(`/${tool}`),
    )?.check;
    const name = check === undefined ? '<check>' : quoteArgument(check.name);
    return disabled.map(([rule]) => {
        return {
            path: [...path, 'rules', rule],
            message: `Disable a lint rule with an ignore. Run: gspot ignore ${name} --rule ${quoteArgument(rule)} --reason "..."`,
        };
    });
}

// Duplicate scope declarations after case and Unicode normalization.
function duplicateScopeProblems(paths: string[]): PolicyProblem[] {
    const seen = new Set<string>();
    const problems: PolicyProblem[] = [];
    for (const [index, path] of paths.entries()) {
        const key = pathKey(path);
        if (seen.has(key))
            problems.push({
                path: ['scope', index, 'path'],
                message: `Scope path is declared more than once: ${path}.`,
            });
        seen.add(key);
    }
    return problems;
}

function isThresholdLoosening(direction: 'ceiling' | 'floor', value: unknown, shipped: unknown): boolean {
    if (
        (typeof value !== 'number' && typeof value !== 'boolean') ||
        (typeof shipped !== 'number' && typeof shipped !== 'boolean')
    )
        return false;
    return direction === 'ceiling' ? Number(value) > Number(shipped) : Number(value) < Number(shipped);
}

/**
 * Describes a missing or invalid reason using the same contract for commands and saved policy.
 * @param where the policy entry or command needing a reason
 * @param reason the authored explanation, when present
 * @param command an available command that can correct the entry
 * @returns the problem, or undefined when the reason is accepted
 */
export function reasonDiagnostic(where: string, reason: string | undefined, command?: string): string | undefined {
    if (reason === undefined)
        return `${where} needs a reason. Add \`reason = "..."\` to this entry.${command === undefined ? '' : ' Or run: ' + command}`;
    if (isReasonAccepted(reason)) return undefined;
    const refused = reason.trim() === '' ? 'an empty reason' : `"${reason}"`;
    return `${where} needs a reason that says something: ${refused} is refused. Write one sentence saying why.`;
}

/**
 * Missing or invalid reasons on ignores, declarations, naming exceptions, and custom tool options.
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function reasonProblems(policy: Policy): PolicyProblem[] {
    const tools = everyTable(policy).flatMap(({ table: layer, path }) =>
        (layer.tools === undefined ? [] : Object.entries(layer.tools)).flatMap(([tool, table]) =>
            toolReasonProblems(tool, table, policy.require_reasons, [...path, 'tools', tool]),
        ),
    );
    return [...ignoreProblems(policy), ...declarationProblems(policy), ...namingPathProblems(policy), ...tools];
}

/**
 * Reports lint rules disabled outside the ignore policy.
 * @param policy the normalized policy
 * @returns the prohibited changes, regardless of require_reasons
 */
export function restrictionProblems(policy: Policy): PolicyProblem[] {
    return everyTable(policy).flatMap(({ table: layer, path }) =>
        (layer.tools === undefined ? [] : Object.entries(layer.tools)).flatMap(([tool, table]) => {
            const location = [...path, 'tools', tool];
            const overrides = Array.isArray(table['overrides']) ? table['overrides'] : [];
            return [
                ...disabledRuleProblems(tool, table, location),
                ...overrides.flatMap((override: unknown, index) =>
                    isRecord(override) ? disabledRuleProblems(tool, override, [...location, 'overrides', index]) : [],
                ),
            ];
        }),
    );
}

/**
 * Refuses file-valued or duplicate scope paths while retaining absent authored projects.
 * @param root the repository root
 * @param policy the normalized policy
 * @returns the problems in plain English
 */
export function pathProblems(root: string, policy: Policy): PolicyProblem[] {
    const paths = policy.scopes.map((scope) => scope.path);
    using files = openRoot(root);
    const missing = paths.flatMap((path, index) => {
        const location: KeyPath = ['scope', index, 'path'];
        try {
            const entry = files.stat(path);
            return entry === undefined || entry.isDirectory()
                ? []
                : [
                      {
                          path: location,
                          message: `The scope \`${path}\` names a file. Declare a directory under the repository root.`,
                      },
                  ];
        } catch (error) {
            return [{ path: location, message: String(error) }];
        }
    });
    return [...missing, ...duplicateScopeProblems(paths)];
}

/**
 * Checks that the reason meets the minimum word count.
 * @param reason the reason as written, if any
 * @returns whether the reason is accepted
 */
export function isReasonAccepted(reason: string | undefined): boolean {
    if (reason === undefined) return false;
    const trimmed = reason.trim();
    return trimmed.split(/\s+/u).filter((word) => word !== '').length >= REASON_WORDS_MIN;
}

/**
 * True when setting `value` for `spec` is a loosening against `shipped` and so carries a reason.
 * @param spec the setting
 * @param value the value written
 * @param shipped the shipped default
 * @returns whether a reason is needed
 */
export function isLoosening(spec: SettingSpec, value: unknown, shipped: unknown): boolean {
    if (spec.direction === 'loosening')
        return Array.isArray(value)
            ? value.some((item) => !Array.isArray(shipped) || !shipped.some((entry) => isDeepStrictEqual(item, entry)))
            : true;
    if (spec.direction === 'ceiling' || spec.direction === 'floor')
        return isThresholdLoosening(spec.direction, value, shipped);
    return false;
}
