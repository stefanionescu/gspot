import type { Session } from '#cli/types/tools.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { ScriptFile } from '#cli/types/configurations/language.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';

import {
    SAFETY_RULES,
    COMMAND_FORMS,
    RECURSIVE_FLAG,
    ALL_LEVEL_FORMS,
    BASH_FORM_MESSAGES,
    BROAD_KILL_COMMANDS,
    IGNORED_FAILURE_MESSAGE,
    RECURSIVE_REMOVE_MESSAGE,
} from '#cli/config/configurations/bash.ts';

function findCommandForm(
    command: ScriptFile['commands'][number],
    isAll: boolean,
): Pick<CheckFinding, 'rule' | 'message'> | undefined {
    const form = COMMAND_FORMS[command.name];
    if (form === undefined || (form.allLevel === true && !isAll)) return undefined;
    const words = command.arguments.filter((argument) => argument !== undefined);
    const { present = [], absent } = form;
    const isUsed =
        present.every((flag) => words.some((word) => flag.test(word))) &&
        !words.some((word) => absent?.test(word) === true);
    return isUsed ? { rule: form.rule, message: form.message } : undefined;
}

/**
Reports each unsafe process kill or removal and each form that BASH.md forbids, and at level `all`, each discarded
failure, `set -x`, `seq` loop, and script-level `IFS`.

@param session the repository and its tools.
@param planned the scope scripts and level.
*/
export async function checkSafety(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    const isAll = session.settings.level === 'all';
    return scripts.flatMap((file) => [
        ...file.commands.flatMap((command): CheckFinding[] => {
            const kill = BROAD_KILL_COMMANDS.get(command.name);
            if (kill !== undefined)
                return [{ file: file.path, line: command.line, rule: SAFETY_RULES.broadKill, message: kill }];
            const form = findCommandForm(command, isAll);
            if (form !== undefined) return [{ file: file.path, line: command.line, ...form }];
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
        ...file.forms
            .filter(({ form }) => isAll || !ALL_LEVEL_FORMS.has(form))
            .map(({ form, line }) => ({ file: file.path, line, rule: form, message: BASH_FORM_MESSAGES[form] })),
        ...(isAll
            ? file.swallowedLines.map((line) => ({
                  file: file.path,
                  line,
                  rule: SAFETY_RULES.ignoredFailure,
                  message: IGNORED_FAILURE_MESSAGE,
              }))
            : []),
    ]);
}
