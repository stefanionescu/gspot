import { DEFAULT_DIALECT } from '#cli/config/repository/files.ts';
import { runCommandBatches } from '#cli/engine/tool-runs/check.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';

const BATS_EXTENSION = '.bats';

// bats runs each test in a subshell, defines tests below the helpers they call, and reads variables from loaded
// helpers, so these warnings misread a bats file.
const BATS_FLAG = '--exclude=SC2030,SC2031,SC2034,SC2218';

const SHELLCHECK_DIALECT_FLAG = '--shell=';

/**
Runs ShellCheck. It passes a dialect only for scripts without a shebang, and leaves out the warnings that do not fit
how bats runs a file.
*/
async function checkShellcheck(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const groups = Map.groupBy(planned.files, (file) => {
        if (file.path.endsWith(BATS_EXTENSION)) return BATS_FLAG;
        if (file.path.endsWith(`.${DEFAULT_DIALECT}`)) return undefined;
        return readText(session.cache, file.path).startsWith('#!')
            ? undefined
            : `${SHELLCHECK_DIALECT_FLAG}${DEFAULT_DIALECT}`;
    });
    const command = planned.check.command as string[];
    return runCommandBatches(
        session,
        planned,
        [...groups].map(([flag, files]) => ({
            files,
            command: flag === undefined ? command : command.toSpliced(1, 0, flag),
        })),
    );
}

export const BASH_SHELLCHECK_CHECKS: Readonly<Record<string, CheckCode>> = {
    'bash/shellcheck': { run: checkShellcheck },
};
