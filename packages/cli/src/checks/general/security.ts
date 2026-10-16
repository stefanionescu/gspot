import { join } from 'node:path';
import { buildBaseResult } from '#cli/checks/run/report.ts';
import { buildScopeTarget } from '#cli/repository/scopes.ts';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { SEMGREP_TOOL } from '#cli/config/checks/general/security.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';

/**
 * The selected Semgrep packs and repository rule paths for one scope.
 * @param session the current level and applied tool targets.
 * @param planned the selected scope and its authored rules.
 * @returns the required rule paths, relative to the repository.
 */
function listSemgrepRuleFiles(session: Session, planned: PlannedCheck): string[] {
    const { selected, scope, view } = planned.scope;
    const declared = selected.flatMap((manifest) =>
        manifest.toolFiles
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.target.endsWith('.yml'))
            .filter((file) => file.level !== 'all' || session.settingsFile.settings.level === 'all')
            .map((file) => buildScopeTarget(scope.path, file, session.toolFiles().targets)),
    );
    return [...new Set([...declared, ...view.options('tools.semgrep').rule_files])];
}

/**
 * Run the selected Semgrep packs and authored rule paths through the command runner.
 * @param session the repository and installed tools.
 * @param planned the check for one scope and its required rules.
 * @returns findings and execution failures.
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
