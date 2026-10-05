import { readSource } from '#cli/platform/source.ts';
import { emptyResult } from '#cli/execution/report.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/runtime.ts';

/**
 * Preserve each script's shebang and supply a dialect only for scripts without one.
 * @param session the source inventory and native tool context
 * @param planned the ShellCheck command and selected files
 * @returns findings from every dialect group, with shared native failure handling
 */
export async function shellcheck(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.spec.command;
    if (command === undefined) return runCommandCheck(session, planned);
    const groups = Map.groupBy(planned.files, (file) => {
        if (readSource(session.root, file.path, session.reads).toString('utf8').startsWith('#!')) return undefined;
        return file.tags.includes('bats') ? 'bats' : 'bash';
    });
    const result = emptyResult(planned);
    for (const [dialect, files] of groups) {
        const checked = await runCommandCheck(
            session,
            { ...planned, files },
            {
                command: dialect === undefined ? command : command.toSpliced(1, 0, `--shell=${dialect}`),
            },
        );
        result.findings.push(...checked.findings);
        result.duration += checked.duration;
        if (!['passed', 'failed'].includes(checked.status))
            return { ...checked, fileCount: result.fileCount, duration: result.duration, findings: result.findings };
        if (checked.status === 'failed') result.status = 'failed';
    }
    return result;
}
