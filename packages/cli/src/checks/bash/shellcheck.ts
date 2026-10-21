import { type Session } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommandGroups } from '#cli/runs/command/check.ts';
import { DEFAULT_DIALECT } from '#cli/config/repository/inventory.ts';
import { BATS_EXTENSION, SHELLCHECK_DIALECT_FLAG } from '#cli/config/checks/bash.ts';

/**
 * Runs ShellCheck, and passes a dialect only for scripts without a shebang.
 *
 * @param session the repository and its tools.
 * @param planned the ShellCheck check and its files.
 * @returns the check result.
 */
export async function checkBashShellcheck(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const groups = Map.groupBy(planned.files, (file) => {
        if (file.path.endsWith(BATS_EXTENSION) || file.path.endsWith(`.${DEFAULT_DIALECT}`)) return undefined;
        if (readCachedText(session.reads, file.path).startsWith('#!')) return undefined;
        return DEFAULT_DIALECT;
    });
    return runCommandGroups(
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
