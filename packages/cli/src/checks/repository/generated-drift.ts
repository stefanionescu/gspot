import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { DRIFT_HELP, MESSAGES } from '#cli/constants/checks/repository.ts';

/**
 * One finding per generated file that differs from its render, is missing, or is a stray gspot file.
 * @param input the engine input
 * @returns the findings
 */
export function generatedDrift(input: EngineInput): Finding[] {
    if (input.generatedDrift === undefined) throw new Error('Generated drift requires once-only execution.');
    return input.generatedDrift().map((entry) => ({
        check: input.spec.name,
        file: entry.path,
        rule: entry.kind,
        message: MESSAGES[entry.kind],
        help: DRIFT_HELP[entry.kind],
        fixable: true,
    }));
}
