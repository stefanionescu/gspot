import type { Finding, CheckInput, FindingPlace } from '#cli/types/checks/run/check.ts';

/**
 * A finding of a check: it names the check, points at a place, and has no automatic fix.
 * @param input the check input of the check.
 * @param at the file, and the line and column when known.
 * @param rule the rule the finding breaks.
 * @param message the problem to report.
 * @param options the help and automatic-fix status.
 * @returns the finding with the supplied location fields.
 */
export function buildFinding(
    input: Pick<CheckInput, 'check'>,
    at: FindingPlace,
    rule: string,
    message: string,
    options: Partial<Pick<Finding, 'help' | 'fixable'>> = {},
): Finding {
    return {
        check: input.check.name,
        ...at,
        rule,
        message,
        fixable: false,
        ...options,
    };
}
