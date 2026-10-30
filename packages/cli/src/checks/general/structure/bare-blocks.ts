import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readParsedSources } from '#cli/checks/general/structure/parsed-sources.ts';
import { BARE_BLOCK_RULE, BARE_BLOCK_MESSAGE } from '#cli/config/checks/general/structure/bare-blocks.ts';

/**
Reports each Swift `do` block without a `catch` block, which only groups statements. ESLint reports the bare blocks
of JavaScript and TypeScript.

@param session the repository and its tools.
@param planned the scope sources.
*/
export async function checkStructureBareBlocks(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const parsed = await readParsedSources(session, planned);
    return parsed.flatMap((source) =>
        (source.captures.get('block') ?? [])
            .filter((node) => node.namedChildren.every((child) => child.type !== 'catch_block'))
            .map((node) => ({
                file: source.path,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
                rule: BARE_BLOCK_RULE,
                message: BARE_BLOCK_MESSAGE,
            })),
    );
}
