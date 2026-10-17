import { readCachedBytes } from '#cli/system/files/reads.ts';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { runCommandGroups } from '#cli/checks/run/command/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { BATS_TAG, DEFAULT_DIALECT, SHELLCHECK_DIALECT_FLAG } from '#cli/config/repository/inventory.ts';

/**
 * Runs ShellCheck, and passes a dialect only for scripts without a shebang.
 * @param session the repository and its tools.
 * @param planned the ShellCheck check and its files.
 * @returns the check result.
 */
export async function checkShellcheck(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const groups = Map.groupBy(planned.files, (file) => {
        if (file.path.endsWith(`.${BATS_TAG}`) || file.path.endsWith(`.${DEFAULT_DIALECT}`)) return undefined;
        if (readCachedBytes(session.reads, file.path).toString('utf8').startsWith('#!')) return undefined;
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
