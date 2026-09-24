import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/reports.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import { eslintCoverageResponse } from '#cli/schemas/evaluation.ts';
// integrity/required-rules: the configuration ESLint resolves for a file still turns on every rule a configuration requires.
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';

const ESLINT_FILE = '.gspot/config/eslint.config.mjs';
const LINT_CHECKS = ['javascript/eslint', 'typescript/eslint'];

// The rules the selected configurations require, for each file ending they name.
function requiredByEnding(input: EngineInput): Map<string, Set<string>> {
    const selected = input.selection.selected;
    const required = new Map<string, Set<string>>();
    for (const manifest of selected)
        for (const [ending, rules] of Object.entries(manifest.required_rules))
            required.set(ending, new Set([...(required.get(ending) ?? []), ...rules]));
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
            file.nature === 'source' &&
            scopeOf(file.path, input.scopeEntries).path === input.scope &&
            required.has(file.path.split('.').at(-1) ?? ''),
    );
    if (files.length === 0) return findings;
    const resolved = eslintCoverageResponse.parse(
        await evaluateConfiguration(
            { tool: 'eslint', operation: 'coverage', root: input.root, paths: files.map((file) => file.path) },
            input.view,
            input.cancelSignal,
        ),
    );
    const decided = new Set(LINT_CHECKS.flatMap((check) => input.view.rulesOff(check)));
    for (const file of files) {
        const ending = file.path.split('.').at(-1) ?? '';
        const enabled = new Set(resolved[file.path]);
        const off = [...required.get(ending)!].filter((rule) => !decided.has(rule) && !enabled.has(rule));
        findings.push(
            ...off.map((rule) => ({
                check: input.spec.name,
                file: ESLINT_FILE,
                line: 1,
                rule: 'rule-off',
                message: `${rule} is off for ${file.path}, and the configurations require it for every .${ending} file.`,
                fixable: false,
            })),
        );
    }
    return findings;
}
