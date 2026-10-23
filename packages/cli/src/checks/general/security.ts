import { join } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { type Session } from '#cli/types/session.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { SEMGREP_TOOL } from '#cli/config/checks/general/security.ts';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';

/**
 * List the Semgrep rule files that the configurations and settings of a scope name.
 *
 * @param session the level and config files.
 * @param planned the check for one scope.
 * @returns the repository-relative paths.
 */
function listSemgrepRuleFiles(session: Session, planned: PlannedCheck): string[] {
    const { configurations, folder, settings } = planned.scope;
    const ruleFiles = configurations.flatMap((configuration) =>
        configuration.configFiles
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.target.endsWith('.yml'))
            .filter((file) => file.level !== 'all' || session.settingsFile.settings.level === 'all')
            .map((file) => getConfigFileTarget(folder.path, file, getConfigFiles(session).targets)),
    );
    return [...new Set([...ruleFiles, ...getTable(settings, 'tools.semgrep').rule_files])];
}

/**
 * Runs Semgrep with the rule files of the scope.
 *
 * @param session the repository and installed tools.
 * @param planned the check for one scope.
 * @returns the check result.
 */
export async function checkSecuritySemgrep(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command as string[];
    const rules = listSemgrepRuleFiles(session, planned);
    if (rules.length === 0)
        return {
            ...buildBaseResult(planned, session),
            status: 'skipped',
            cause: 'setting',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        };
    return runCheckCommand(session, planned, {
        command: [...command, ...rules.flatMap((path) => ['--config', join(session.root, path)])],
    });
}
