import { join } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { SEMGREP_TOOL } from '#cli/config/checks/general/security.ts';
import { buildConfigFiles } from '#cli/generation/config-files/generate.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';

function listSemgrepRuleFiles(session: Session, planned: PlannedCheck): string[] {
    const { configurations, path: scopePath, settings } = planned.scope;
    const ruleFiles = configurations.flatMap((configuration) =>
        configuration.configFiles
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.target.endsWith('.yml'))
            .filter((file) => file.level !== 'all' || session.settings.level === 'all')
            .map((file) => getConfigFileTarget(scopePath, file, buildConfigFiles(session))),
    );
    return [...new Set([...ruleFiles, ...getTable(settings, 'tools.semgrep').rule_files])];
}

/**
Runs Semgrep with the rule files of the scope.

@param session the repository and installed tools.
@param planned the check for one scope.
@returns the check result.
*/
export async function checkSecuritySemgrep(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command as string[];
    const rules = listSemgrepRuleFiles(session, planned);
    if (rules.length === 0)
        return {
            ...buildBaseResult(planned, session),
            status: 'skipped',
            cause: 'setting',
            note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
        };
    return runCommandCheck(session, planned, {
        command: [...command, ...rules.flatMap((path) => ['--config', join(session.root, path)])],
    });
}
