// A naming problem as a finding: the identifier, what fired, and where the policy said so.
import type { Finding } from '#types/finding.ts';
import type { Identifier, NameProblem } from '#types/naming.ts';

/**
 * One finding per problem.
 * @param check the check id
 * @param identifier the identifier
 * @param problem what is wrong with it
 * @returns the finding
 */
export function nameFinding(check: string, identifier: Identifier, problem: NameProblem): Finding {
    const source = problem.source === undefined ? '' : ` (${problem.source})`;
    return {
        check,
        file: identifier.file,
        line: identifier.line,
        column: identifier.column,
        rule: problem.rule,
        message: `${identifier.kind} "${identifier.name}": ${problem.message}${source}.`,
        fixable: false,
    };
}
