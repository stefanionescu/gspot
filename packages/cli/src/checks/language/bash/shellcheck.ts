import { compact } from '#cli/platform/objects.ts';
import { readSource } from '#cli/platform/source.ts';
import { emptyResult } from '#cli/execution/report.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';

/**
 * Preserve each script's shebang and supply a dialect only for scripts without one.
 * @param session the source inventory and native tool context
 * @param planned the ShellCheck command and selected files
 * @returns findings from every dialect group, with shared native failure handling
 */
export async function shellcheck(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const groups = Map.groupBy(planned.files, (file) => {
        if (readSource(session.root, file.path, session.reads).toString('utf8').startsWith('#!')) return undefined;
        return file.tags.includes('bats') ? 'bats' : 'bash';
    });
    const result = emptyResult(planned);
    for (const [dialect, files] of groups) {
        const checked = await runCheckCommand(
            session,
            { ...planned, files },
            compact({
                command:
                    dialect === undefined ? undefined : planned.check.command?.toSpliced(1, 0, `--shell=${dialect}`),
            }),
        );
        result.findings.push(...checked.findings);
        result.duration += checked.duration;
        if (!['passed', 'failed'].includes(checked.status))
            return { ...checked, fileCount: result.fileCount, duration: result.duration, findings: result.findings };
        if (checked.status === 'failed') result.status = 'failed';
    }
    return result;
}
