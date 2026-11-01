import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { formatCount, formatNameList } from '#cli/system/text.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { READS_NO_POSITIONAL, UNREAD_ARGUMENTS_RULE } from '#cli/config/configurations/bash.ts';
import { readScripts, listFunctionCalls } from '#cli/configurations/language/bash/checks/scripts.ts';

/**
Reports each function called with more arguments than it reads.

@param session the repository and its tools.
@param planned the scope scripts to read.
*/
export async function checkUnreadArguments(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
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
            const isSingle = unread.length === 1;
            const positions = `${isSingle ? 'position' : 'positions'} ${formatNameList(unread)} ${isSingle ? 'is' : 'are'}`;
            return [
                {
                    file: file.path,
                    line: scriptFunction.start,
                    rule: UNREAD_ARGUMENTS_RULE,
                    message: `${scriptFunction.name} is called with up to ${formatCount(width, 'argument')} but ${read}: ${positions} never read.`,
                },
            ];
        }),
    );
}
