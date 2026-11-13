import { READS_NO_POSITIONAL, UNREAD_ARGUMENTS_RULE } from '#cli/config/configurations/bash.ts';
import { BASH_SOURCE_COMMANDS } from '#cli/config/configurations/shared.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import { formatCount, formatNameState } from '#cli/system/text/messages.ts';
import type { ScriptFile } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

function listFunctionCalls(scripts: ScriptFile[], target: ScriptFile, name: string): ScriptFile['calls'] {
    const callers = scripts.filter(
        (file) => file === target || file.commands.some((call) => BASH_SOURCE_COMMANDS.has(call.name)),
    );
    return callers.flatMap((file) => file.calls.filter((call) => call.name === name));
}

function formatUnreadPositions(width: number, highest: number): string {
    const unread = Array.from({ length: width - highest }, (_, offset) => String(highest + offset + 1));
    return `${unread.length === 1 ? 'position' : 'positions'} ${formatNameState(unread, 'never read')}`;
}

function isChanged(
    name: string,
    file: ScriptFile,
    { scripts, narrowed }: { scripts: ScriptFile[]; narrowed: string[] | undefined },
): boolean {
    const callers = scripts.filter(({ calls }) => calls.some((call) => call.name === name));
    return narrowed === undefined || [file, ...callers].some(({ path }) => narrowed.includes(path));
}

async function checkUnreadArguments(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    const narrowed = session.selection?.paths;
    return scripts.flatMap((file) =>
        file.functions.flatMap((scriptFunction) => {
            if (!isChanged(scriptFunction.name, file, { scripts, narrowed })) return [];
            const width = Math.max(
                0,
                ...listFunctionCalls(scripts, file, scriptFunction.name)
                    .filter((call) => !call.forwards)
                    .map((call) => call.count),
            );
            const highest = scriptFunction.highestRead;
            if (width <= highest) return [];
            const read = highest === 0 ? READS_NO_POSITIONAL : `reads none past $${String(highest)}`;
            const positions = formatUnreadPositions(width, highest);
            return [
                {
                    file: file.path,
                    line: scriptFunction.start,
                    rule: UNREAD_ARGUMENTS_RULE,
                    message: `${scriptFunction.name} is called with up to ${formatCount(width, 'argument')} but ${read}: ${positions}.`,
                },
            ];
        }),
    );
}

export const BASH_UNREAD_ARGUMENTS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'bash/unread-arguments': { check: checkUnreadArguments },
};
