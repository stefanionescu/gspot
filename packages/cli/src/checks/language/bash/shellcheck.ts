import { readSource } from '#cli/system/files/reads.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCommandGroups } from '#cli/execution/command/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { BATS_TAG, DEFAULT_DIALECT, SHELLCHECK_DIALECT_FLAG } from '#cli/config/repository/inventory.ts';

/**
 * Preserve each script's shebang and supply a dialect only for scripts without one.
 * @param session the source inventory and tool context.
 * @param planned the ShellCheck command and selected files.
 * @returns findings from every dialect group, with shared failure handling.
 */
export async function shellcheck(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const groups = Map.groupBy(planned.files, (file) => {
        if (file.path.endsWith(`.${BATS_TAG}`) || file.path.endsWith(`.${DEFAULT_DIALECT}`)) return undefined;
        if (readSource(session.root, file.path, session.reads).toString('utf8').startsWith('#!')) return undefined;
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
