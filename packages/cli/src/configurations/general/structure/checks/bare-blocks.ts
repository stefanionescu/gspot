import { BARE_BLOCK_MESSAGE, BARE_BLOCK_RULE } from '#cli/config/configurations/structure.ts';
import { visitQueriedSources } from '#cli/configurations/general/structure/checks/parsed-sources.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Reports each Swift `do` block without a `catch` block, which only groups statements. ESLint reports the bare blocks
of JavaScript and TypeScript.

@param session the repository and its tools.
@param planned the scope sources.
*/
async function checkBareBlocks(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    await visitQueriedSources(session, planned, (source) => {
        const blocks = source.captures.get('block') ?? [];
        findings.push(
            ...blocks
                .filter((node) => node.namedChildren.every((child) => child.type !== 'catch_block'))
                .map((node) => ({
                    file: source.path,
                    line: node.startPosition.row + 1,
                    column: node.startPosition.column + 1,
                    rule: BARE_BLOCK_RULE,
                    message: BARE_BLOCK_MESSAGE,
                })),
        );
    });
    return findings;
}

export const STRUCTURE_BARE_BLOCKS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/bare-blocks': { check: checkBareBlocks },
};
