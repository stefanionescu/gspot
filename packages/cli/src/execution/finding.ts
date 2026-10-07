// The builder checks use to report their identity and source location.

import type { EngineInput } from '#cli/types/execution/runtime.ts';
import type { Finding, FindingPlace } from '#cli/types/parsers/output.ts';

/**
 * A finding of a check: it names the check, points at a place, and has no automatic fix.
 * @param input the engine input of the check
 * @param at the file, and the line and column when known
 * @param rule the rule the finding breaks
 * @param diagnostic what is wrong
 * @returns the finding with the supplied location fields
 */
export function findingAt<Place extends FindingPlace>(
    input: Pick<EngineInput, 'spec'>,
    at: Place,
    rule: string,
    diagnostic: string,
): Finding & Pick<Place, keyof FindingPlace & keyof Place> {
    return { check: input.spec.name, ...at, rule, message: diagnostic, fixable: false };
}
