// integrity/required-rules: the configuration ESLint resolves for a file still turns on every rule a preset requires.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const ESLINT_FILE = '.gspot/eslint.config.mjs';
const PRINT_TIMEOUT_MS = 120_000;
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

async function resolvedRules(input: EngineInput, binary: string, path: string): Promise<Record<string, unknown>> {
    const command = [binary, '--config', join(input.root, ESLINT_FILE), '--print-config', path];
    const result = await run(command, { cwd: input.root, timeoutMs: PRINT_TIMEOUT_MS });
    if (result.code !== 0)
        throw new Error(`The eslint --print-config command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const parsed = JSON.parse(result.stdout) as { rules?: Record<string, unknown> } | undefined;
    return parsed?.rules ?? {};
}

// The required rules that are off in the configuration ESLint resolves for one file.
async function offRules(input: EngineInput, binary: string, sample: string, rules: Set<string>): Promise<string[]> {
    const decided = new Set(LINT_CHECKS.flatMap((check) => input.view.rulesOff(check)));
    const resolved = await resolvedRules(input, binary, sample);
    return [...rules].filter((rule) => !decided.has(rule) && isOff(resolved[rule]));
}

/**
 * One finding for each required rule that the resolved ESLint configuration leaves off for a file of its kind.
 * @param input the engine input
 * @returns the findings
 */
export async function requiredRules(input: EngineInput): Promise<Finding[]> {
    const binary = locateTool(input.root, 'eslint');
    if (binary === undefined) throw new MissingToolError('The eslint command is not installed.');
    const findings: Finding[] = [];
    for (const [ending, rules] of requiredByEnding(input)) {
        const sample = input.files.find((file) => file.nature === 'source' && file.path.endsWith(`.${ending}`))?.path;
        if (sample === undefined) continue;
        const off = await offRules(input, binary, sample, rules);
        findings.push(
            ...off.map((rule) => ({
                check: input.spec.id,
                file: ESLINT_FILE,
                line: 1,
                rule: 'rule-off',
                message: `${rule} is off for ${sample}, and the presets require it for every .${ending} file.`,
                fixable: false,
            })),
        );
    }
    return findings;
}
