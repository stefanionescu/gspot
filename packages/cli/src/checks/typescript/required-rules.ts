import { findingAt } from '#cli/checks/result.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { runConfiguration } from '#cli/lifecycle/preview/eslint/client.ts';
import { eslintCoverageResponse } from '#cli/lifecycle/preview/eslint/protocol.ts';
import { ESLINT_FILE, LINT_CHECKS, ESLINT_RULE_LEVELS } from '#cli/config/checks/typescript.ts';

// The rules the selected kits require, for each file ending they name.
function requiredByEnding(input: EngineInput): Map<string, Set<string>> {
    const selected = input.selection.selected;
    const required = new Map<string, Set<string>>();
    for (const manifest of selected)
        for (const [ending, rules] of Object.entries(manifest.required_rules))
            required.set(
                ending,
                new Set([
                    ...(required.get(ending) ?? []),
                    ...rules.filter(
                        (rule) => input.policyFiles.policy.level === 'all' || ESLINT_RULE_LEVELS[rule] !== 'all',
                    ),
                ]),
            );
    return required;
}

/**
 * One finding for each required rule that the resolved ESLint configuration leaves off for a file of its kind.
 * @param input the engine input
 * @returns the findings
 */
export async function requiredRules(input: EngineInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const findings: Finding[] = [];
    const required = requiredByEnding(input);
    const files = input.files.filter(
        (file) =>
            file.kind === 'source' &&
            scopeOf(file.path, input.scopeEntries).path === input.scope &&
            required.has(file.path.split('.').at(-1) ?? ''),
    );
    if (files.length === 0) return findings;
    const resolved = eslintCoverageResponse.parse(
        await runConfiguration(
            { tool: 'eslint', operation: 'coverage', root: input.root, paths: files.map((file) => file.path) },
            input.view,
            input.cancelSignal,
        ),
    );
    const decided = new Set(LINT_CHECKS.flatMap((check) => input.view.rulesOff(check)));
    for (const file of files) {
        const ending = file.path.split('.').at(-1) ?? '';
        const enabled = new Set(resolved[file.path]);
        const off = [...(required.get(ending) ?? [])].filter((rule) => !decided.has(rule) && !enabled.has(rule));
        findings.push(
            ...off.map((rule) =>
                findingAt(
                    input,
                    { file: ESLINT_FILE, line: 1 },
                    'rule-off',
                    `${rule} is off for ${file.path}, and the configurations require it for every .${ending} file.`,
                ),
            ),
        );
    }
    return findings;
}
