// The builder checks use to report their identity and source location.

import type { CheckInput } from '#cli/types/execution/check.ts';
import type { Finding, FindingPlace } from '#cli/types/parsers/output.ts';

/**
 * A finding of a check: it names the check, points at a place, and has no automatic fix.
 * @param input the check input of the check
 * @param at the file, and the line and column when known
 * @param rule the rule the finding breaks
 * @param diagnostic what is wrong
 * @returns the finding with the supplied location fields
 */
export function findingAt<Place extends FindingPlace>(
    input: Pick<CheckInput, 'check'>,
    at: Place,
    rule: string,
    diagnostic: string,
): Finding & Pick<Place, keyof FindingPlace & keyof Place> {
    return { check: input.check.name, ...at, rule, message: diagnostic, fixable: false };
}
