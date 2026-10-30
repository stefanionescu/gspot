import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';

import {
    SAFETY_RULES,
    RECURSIVE_FLAG,
    BROAD_KILL_COMMANDS,
    IGNORED_FAILURE_MESSAGE,
    RECURSIVE_REMOVE_MESSAGE,
} from '#cli/config/checks/language/bash.ts';

/**
Reports each unsafe process kill or removal, and at level `all`, each discarded failure.

@param session the repository and its tools.
@param planned the scope scripts and level.
*/
export async function checkSafety(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) => [
        ...file.commands.flatMap((command): CheckFinding[] => {
            const kill = BROAD_KILL_COMMANDS.get(command.name);
            if (kill !== undefined)
                return [
                    {
                        file: file.path,
                        line: command.line,
                        rule: SAFETY_RULES.broadKill,
                        message: kill,
                    },
                ];
            if (
                command.name !== 'rm' ||
                !command.arguments.some((argument) => argument !== undefined && RECURSIVE_FLAG.test(argument))
            )
                return [];
            const isCleanup = file.temporaryPaths.some((temporary) => temporary.cleanupLines.includes(command.line));
            return isCleanup
                ? []
                : [
                      {
                          file: file.path,
                          line: command.line,
                          rule: SAFETY_RULES.recursiveRemove,
                          message: RECURSIVE_REMOVE_MESSAGE,
                      },
                  ];
        }),
        ...(session.settings.level === 'all'
            ? file.swallowedLines.map((line) => ({
                  file: file.path,
                  line,
                  rule: SAFETY_RULES.ignoredFailure,
                  message: IGNORED_FAILURE_MESSAGE,
              }))
            : []),
    ]);
}
