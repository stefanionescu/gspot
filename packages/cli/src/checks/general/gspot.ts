import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { DRIFT_HELP, DRIFT_MESSAGES } from '#cli/config/lifecycle/drift.ts';

/**
 * Reports managed files that differ from gspot apply output, are missing, contain merge conflict markers, or have a gspot header without a current generator.
 * @param input the engine input
 * @returns the findings
 */
export function gspotDrift(input: EngineInput): Finding[] {
    if (input.generatedDrift === undefined)
        throw new Error(
            'The gspot/drift check needs generated file comparisons, so its manifest must say runs = "once".',
        );
    return input.generatedDrift().map((entry) => ({
        check: input.spec.name,
        file: entry.path,
        rule: entry.kind,
        message: DRIFT_MESSAGES[entry.kind],
        help: DRIFT_HELP[entry.kind],
        fixable: true,
    }));
}
