import { read } from '#cli/system/files/reads.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommandBatches } from '#cli/runs/command/check.ts';
import { DEFAULT_DIALECT } from '#cli/config/repository/files.ts';
import { BATS_EXTENSION, SHELLCHECK_DIALECT_FLAG } from '#cli/config/checks/language/bash.ts';

/**
Runs ShellCheck, and passes a dialect only for scripts without a shebang.

@param session the repository and its tools.
@param planned the ShellCheck check and its files.
*/
export async function checkShellcheck(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const groups = Map.groupBy(planned.files, (file) => {
        if (file.path.endsWith(BATS_EXTENSION) || file.path.endsWith(`.${DEFAULT_DIALECT}`)) return undefined;
        return read(session.cache, file.path).startsWith('#!') ? undefined : DEFAULT_DIALECT;
    });
    return runCommandBatches(
        session,
        planned,
        [...groups].map(([dialect, files]) => ({
            files,
            command:
                dialect === undefined
                    ? (planned.check.command as string[])
                    : (planned.check.command as string[]).toSpliced(1, 0, `${SHELLCHECK_DIALECT_FLAG}${dialect}`),
        })),
    );
}
