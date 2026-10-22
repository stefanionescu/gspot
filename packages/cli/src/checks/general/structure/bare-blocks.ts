import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildFinding, getNodePlace } from '#cli/runs/finding.ts';
import { PARSED_SOURCES } from '#cli/checks/general/structure/parsed-sources.ts';

/**
 * Reports each Swift `do` block without a `catch` block, which only groups statements. ESLint reports the bare blocks
 * of JavaScript and TypeScript.
 *
 * @param session the repository and its tools.
 * @param planned the scope sources.
 * @returns one finding per bare block.
 */
export async function checkStructureBareBlocks(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const parsed = await parseCached({ ...session, files: planned.files, scope: planned.scope }, PARSED_SOURCES);
    return parsed.flatMap((source) =>
        (source.captures.get('block') ?? [])
            .filter((node) => !node.namedChildren.some((child) => child.type === 'catch_block'))
            .map((node) =>
                buildFinding(
                    planned,
                    getNodePlace(source.path, node),
                    'bare-block',
                    'A do block without catch hides a step. Name the step as a function, or remove the do.',
                ),
            ),
    );
}
