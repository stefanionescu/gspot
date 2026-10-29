import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts, listFunctionCalls } from '#cli/checks/language/bash/scripts.ts';
import { READS_NO_POSITIONAL, UNREAD_ARGUMENTS_RULE } from '#cli/config/checks/language/bash/unread-arguments.ts';

/**
Reports each function called with more arguments than it reads.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkBashUnreadArguments(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.functions.flatMap((scriptFunction) => {
            const width = Math.max(
                0,
                ...listFunctionCalls(scripts, file, scriptFunction.name)
                    .filter((call) => !call.forwards)
                    .map((call) => call.count),
            );
            const highest = scriptFunction.highestRead;
            if (width <= highest) return [];
            const unread = Array.from({ length: width - highest }, (_, offset) => String(highest + offset + 1));
            const read = highest === 0 ? READS_NO_POSITIONAL : `reads none past $${String(highest)}`;
            const positions =
                unread.length === 1 ? `position ${unread.join('')} is` : `positions ${unread.join(' and ')} are`;
            return [
                {
                    file: file.path,
                    line: scriptFunction.start,
                    rule: UNREAD_ARGUMENTS_RULE,
                    message: `${scriptFunction.name} is called with up to ${String(width)} ${width === 1 ? 'argument' : 'arguments'} but ${read}: ${positions} never read.`,
                },
            ];
        }),
    );
}
