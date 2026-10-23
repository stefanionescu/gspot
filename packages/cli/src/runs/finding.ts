import type { Node } from 'web-tree-sitter';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding, FindingPlace } from '#cli/types/runs/check.ts';

/**
 * Builds a finding that names the check and, by default, has no automatic fix.
 *
 * @param planned the check that reports it.
 * @param at the file, and the line and column when known.
 * @param rule the ID of the broken requirement.
 * @param message the text that says what went wrong.
 * @param options the help and automatic-fix status.
 * @returns a finding ready for the report.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 109 calls in 62 files share it.
export function buildFinding(
    planned: Pick<PlannedCheck, 'check'>,
    at: FindingPlace,
    rule: string,
    message: string,
    options: Partial<Pick<Finding, 'help' | 'fixable'>> = {},
): Finding {
    return {
        check: planned.check.id,
        ...at,
        rule,
        message,
        fixable: false,
        ...options,
    };
}

/**
 * Locate a parsed node by line and column, both counted from one.
 *
 * @param file the repository path of the source.
 * @param node what the finding points at.
 * @returns the file, line, and column.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 6 files share it.
export function getNodePlace(file: string, node: Node): FindingPlace {
    return { file, line: node.startPosition.row + 1, column: node.startPosition.column + 1 };
}
