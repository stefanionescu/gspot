import type { Session } from '#cli/types/session.ts';
import type { CheckFinding } from '#cli/types/engine/check.ts';
import type { PlannedCheck } from '#cli/types/engine/planning.ts';
import { BARE_BLOCK_RULE, BARE_BLOCK_MESSAGE } from '#cli/config/configurations/structure.ts';
import { readParsedSources } from '#cli/configurations/general/structure/checks/parsed-sources.ts';

/**
Reports each Swift `do` block without a `catch` block, which only groups statements. ESLint reports the bare blocks
of JavaScript and TypeScript.

@param session the repository and its tools.
@param planned the scope sources.
*/
export async function checkBareBlocks(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
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
