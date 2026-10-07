import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { LINT_CHECK } from '#cli/config/generation/eslint.ts';
import { ESLINT_FILE } from '#cli/config/platform/locations.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { readEslintCoverage } from '#cli/tools/eslint/client.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { EslintCoverageResponse } from '#cli/types/parsers/eslint.ts';
import { eslintAllRulesSchema, eslintCoverageResponseSchema } from '#cli/parsers/schema/eslint.ts';
import type { MissingEslintRule, RequiredEslintRules } from '#cli/types/checks/language/javascript.ts';
import { RULE_OFF_PATHS, REQUIRED_ESLINT_LANGUAGE_CONTRACTS } from '#cli/config/checks/language/javascript.ts';
import ESLINT_ALL_RULES from '../../../../configurations/language/javascript/eslint-all-rules.json' with { type: 'json' };

// Expand language contracts through inventory metadata; framework requirements retain their exact endings.
function getRequiredRules(input: EngineInput): RequiredEslintRules {
    const allRules = eslintAllRulesSchema.parse(ESLINT_ALL_RULES);
    const selected = input.selection.selected;
    const required: RequiredEslintRules = new Map();
    for (const manifest of selected) {
        const language = REQUIRED_ESLINT_LANGUAGE_CONTRACTS[manifest.configuration.name];
        const declarations = Object.entries(manifest.required_eslint_rules).flatMap(([ending, rules]) => {
            const endings =
                ending === language?.ending
                    ? [
                          ...extensionsTagged(...language.languages).map((extension) => extension.slice(1)),
                          ...manifest.files.tags,
                      ]
                    : [ending];
            return endings.map((key) => ({ ending: key, rules }));
        });
        for (const { ending, rules } of declarations) {
            const owners = required.get(ending) ?? new Map<string, Set<string>>();
            const applicable = rules.filter((rule) => input.policyFiles.policy.level === 'all' || !allRules.has(rule));
            for (const rule of applicable) {
                const configurations = owners.get(rule) ?? new Set<string>();
                configurations.add(manifest.configuration.name);
                owners.set(rule, configurations);
            }
            required.set(ending, owners);
        }
    }
    return required;
}

// Source extensions take precedence; detected script tags cover names without a recognized language ending.
function fileRules(required: RequiredEslintRules, file: TrackedFile): Map<string, Set<string>> | undefined {
    const ending = posix.extname(file.path).slice(1);
    const tag = file.tags.find((entry) => required.has(entry));
    return required.get(ending) ?? (tag === undefined ? undefined : required.get(tag));
}

// Count each missing rule once while preserving affected paths and declaration owners.
function getMissingRules(
    required: RequiredEslintRules,
    files: TrackedFile[],
    resolved: EslintCoverageResponse,
    decided: Set<string>,
): Map<string, MissingEslintRule> {
    const missing = new Map<string, MissingEslintRule>();
    for (const file of files) {
        const enabled = new Set(resolved[file.path]);
        for (const [rule, owners] of fileRules(required, file) ?? []) {
            if (decided.has(rule) || enabled.has(rule)) continue;
            const entry = missing.get(rule) ?? { files: new Set<string>(), configurations: new Set<string>() };
            entry.files.add(file.path);
            entry.configurations = new Set([...entry.configurations, ...owners]);
            missing.set(rule, entry);
        }
    }
    return missing;
}

/**
 * One finding per required rule left disabled, with its affected file count, sample paths, and configuration owners.
 * @param input the engine input
 * @returns the findings
 */
export async function rulesOff(input: EngineInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const required = getRequiredRules(input);
    const files = input.files.filter(
        (file) =>
            file.kind === 'source' &&
            scopeOf(file.path, input.scopeEntries).path === input.scope &&
            fileRules(required, file) !== undefined,
    );
    if (files.length === 0) return [];
    const resolved = eslintCoverageResponseSchema.parse(
        await readEslintCoverage({ root: input.root, paths: files.map((file) => file.path) }, (command) =>
            runEngineTool(input, command, { cwd: input.root }),
        ),
    );
    const decided = new Set(input.view.rulesOff(LINT_CHECK));
    return [...getMissingRules(required, files, resolved, decided)].map(([rule, entry]) => {
        const paths = [...entry.files].toSorted((left, right) => left.localeCompare(right));
        const shown = paths.slice(0, RULE_OFF_PATHS).join(', ');
        const more = paths.length > RULE_OFF_PATHS ? `, and ${String(paths.length - RULE_OFF_PATHS)} more` : '';
        const owners = [...entry.configurations].toSorted((left, right) => left.localeCompare(right));
        const plural = owners.length === 1 ? '' : 's';
        return findingAt(
            input,
            { file: ESLINT_FILE, line: 1 },
            'rule-off',
            `Enable ${rule} for ${String(paths.length)} ${paths.length === 1 ? 'file' : 'files'} (${shown}${more}). The ${owners.join(', ')} configuration${plural} require${owners.length === 1 ? 's' : ''} this rule.`,
        );
    });
}
