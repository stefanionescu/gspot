// integrity/required-rules: the configuration ESLint resolves for a file still turns on every rule a preset requires.
import { join } from 'node:path';
import { z } from 'zod';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';

const ESLINT_FILE = '.gspot/eslint.config.mjs';
const resolvedConfig = z.object({ rules: z.record(z.string(), z.unknown()).optional() });
const LINT_CHECKS = ['javascript/eslint', 'typescript/eslint'];

// The rules the selected presets require, for each file ending they name.
function requiredByEnding(input: EngineInput): Map<string, Set<string>> {
    const selected = input.session.scopes.find((scope) => scope.scope.path === input.scope)?.selected ?? [];
    const required = new Map<string, Set<string>>();
    for (const manifest of selected)
        for (const [ending, rules] of Object.entries(manifest.required_rules))
            required.set(ending, new Set([...(required.get(ending) ?? []), ...rules]));
    return required;
}

function isOff(entry: unknown): boolean {
    const level: unknown = Array.isArray(entry) ? entry[0] : entry;
    return [undefined, 0, 'off'].includes(level as string | number | undefined);
}

async function resolvedRules(input: EngineInput, path: string): Promise<Record<string, unknown>> {
    const command = ['eslint', '--config', join(input.root, ESLINT_FILE), '--print-config', path];
    const result = await runCheckCommand(input, command, { cwd: input.root });
    if (result.code !== 0)
        throw new Error(`The eslint --print-config command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const parsed = resolvedConfig.parse(JSON.parse(result.stdout));
    return parsed.rules ?? {};
}

// The required rules that are off in the configuration ESLint resolves for one file.
async function offRules(input: EngineInput, sample: string, rules: Set<string>): Promise<string[]> {
    const decided = new Set(LINT_CHECKS.flatMap((check) => input.view.rulesOff(check)));
    const resolved = await resolvedRules(input, sample);
    return [...rules].filter((rule) => !decided.has(rule) && isOff(resolved[rule]));
}

/**
 * One finding for each required rule that the resolved ESLint configuration leaves off for a file of its kind.
 * @param input the engine input
 * @returns the findings
 */
export async function requiredRules(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    const required = requiredByEnding(input);
    for (const file of input.files) {
        if (file.nature !== 'source' || scopeOf(file.path, input.session.repository.scopes).path !== input.scope)
            continue;
        const ending = file.path.split('.').at(-1) ?? '';
        const rules = required.get(ending);
        if (rules === undefined) continue;
        const off = await offRules(input, file.path, rules);
        findings.push(
            ...off.map((rule) => ({
                check: input.spec.name,
                file: ESLINT_FILE,
                line: 1,
                rule: 'rule-off',
                message: `${rule} is off for ${file.path}, and the presets require it for every .${ending} file.`,
                fixable: false,
            })),
        );
    }
    return findings;
}
