import { join } from 'node:path';
import { buildBaseResult } from '#cli/runs/report.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { SEMGREP_TOOL } from '#cli/config/checks/security.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';

/**
 * List the Semgrep rule files that the configurations and settings of a scope name.
 *
 * @param session the level and tool files.
 * @param planned the check for one scope.
 * @returns the repository-relative paths.
 */
function listSemgrepRuleFiles(session: Session, planned: PlannedCheck): string[] {
    const { selected, scope, view } = planned.selection;
    const declared = selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.target.endsWith('.yml'))
            .filter((file) => file.level !== 'all' || session.settingsFile.settings.level === 'all')
            .map((file) => buildScopeTarget(scope.path, file, session.toolFiles().targets)),
    );
    return [...new Set([...declared, ...view.options('tools.semgrep').rule_files])];
}

/**
 * Runs Semgrep with the rule files of the scope.
 *
 * @param session the repository and installed tools.
 * @param planned the check for one scope.
 * @returns the check result.
 */
export async function checkSemgrep(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command as string[];
    const rules = listSemgrepRuleFiles(session, planned);
    if (rules.length === 0)
        return {
            ...buildBaseResult(planned, session),
            status: 'skipped',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        };
    return runCheckCommand(session, planned, {
        command: [...command, ...rules.flatMap((path) => ['--config', join(session.root, path)])],
    });
}
