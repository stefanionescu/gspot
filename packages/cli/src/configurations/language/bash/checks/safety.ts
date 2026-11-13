import {
    ALL_LEVEL_FORMS,
    BASH_FORM_MESSAGES,
    BROAD_KILL_COMMANDS,
    COMMAND_FORMS,
    IGNORED_FAILURE_MESSAGE,
    RECURSIVE_FLAG,
    RECURSIVE_REMOVE_MESSAGE,
    SAFETY_RULES,
} from '#cli/config/configurations/bash.ts';
import { readScripts } from '#cli/configurations/language/bash/checks/scripts.ts';
import { SAFETY_EXPLANATIONS } from '#cli/configurations/language/bash/explanations.ts';
import type { ScriptFile } from '#cli/types/configurations/language.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function findCommandForm(
    command: ScriptFile['commands'][number],
    { isAll }: { isAll: boolean },
): Pick<CheckFinding, 'rule' | 'message'> | undefined {
    const form = COMMAND_FORMS[command.name];
    if (form === undefined || (!isAll && form.allLevel === true)) return undefined;
    const words = command.arguments.filter((argument) => argument !== undefined);
    const { present = [], absent } = form;
    const isUsed =
        present.every((flag) => words.some((word) => flag.test(word))) &&
        words.every((word) => absent?.test(word) !== true);
    return isUsed ? { rule: form.rule, message: form.message } : undefined;
}

function listCommandFindings(
    file: ScriptFile,
    command: ScriptFile['commands'][number],
    level: { isAll: boolean },
): CheckFinding[] {
    const kill = BROAD_KILL_COMMANDS.get(command.name);
    if (kill !== undefined)
        return [{ file: file.path, line: command.line, rule: SAFETY_RULES.broadKill, message: kill }];
    if (file.functions.some(({ name }) => name === command.name)) return [];
    const form = findCommandForm(command, level);
    if (form !== undefined) return [{ file: file.path, line: command.line, ...form }];
    if (
        command.name !== 'rm' ||
        command.arguments.every((argument) => argument === undefined || !RECURSIVE_FLAG.test(argument))
    )
        return [];
    const isCleanup = file.temporaryPaths.some(
        ({ cleanupLines, removalLines }) => cleanupLines.includes(command.line) || removalLines.includes(command.line),
    );
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
}

async function checkSafety(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const scripts = await readScripts(session, planned);
    const isAll = session.settings.level === 'all';
    return scripts.flatMap((file) => [
        ...file.commands.flatMap((command) => listCommandFindings(file, command, { isAll })),
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

export const BASH_SAFETY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'bash/safety': { check: checkSafety, explanations: SAFETY_EXPLANATIONS },
};
