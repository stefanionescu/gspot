import { DRIFT_HELP, DRIFT_MESSAGES } from '#cli/config/checks/checks.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

/**
 * One finding per generated file that differs from its render, is missing, or is a stray gspot file.
 * @param input the engine input
 * @returns the findings
 */
export function drift(input: EngineInput): Finding[] {
    if (input.generatedDrift === undefined) throw new Error('Generated drift requires once-only execution.');
    return input.generatedDrift().map((entry) => ({
        check: input.spec.name,
        file: entry.path,
        rule: entry.kind,
        message: DRIFT_MESSAGES[entry.kind],
        help: DRIFT_HELP[entry.kind],
        fixable: true,
    }));
}
