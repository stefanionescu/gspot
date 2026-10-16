// Builds one finding for a check gspot runs itself.

import type { Finding, CheckInput, FindingPlace } from '#cli/types/execution/check.ts';

/**
 * A finding of a check: it names the check, points at a place, and has no automatic fix.
 * @param input the check input of the check.
 * @param at the file, and the line and column when known.
 * @param rule the rule the finding breaks.
 * @param message the problem to report.
 * @param options the help and automatic-fix status.
 * @returns the finding with the supplied location fields.
 */
export function findingAt(
    input: Pick<CheckInput, 'check'>,
    at: FindingPlace,
    rule: string | undefined,
    message: string,
    options: Partial<Pick<Finding, 'help' | 'fixable'>> = {},
): Finding {
    return {
        check: input.check.name,
        ...at,
        ...(rule === undefined ? {} : { rule }),
        message,
        fixable: false,
        ...options,
    };
}

/**
 * Select source paths by extension or whole file name.
 * @param input the selected check and repository files.
 * @param endings the file extensions to select.
 * @returns the selected source paths.
 */
export function sourcePaths(input: CheckInput, endings?: readonly string[]): string[] {
    return input.files
        .filter(
            (file) =>
                file.kind === 'source' &&
                (endings === undefined ||
                    endings.some((ending) =>
                        ending.startsWith('.')
                            ? file.path.endsWith(ending)
                            : file.path === ending || file.path.endsWith(`/${ending}`),
                    )),
        )
        .map((file) => file.path);
}
