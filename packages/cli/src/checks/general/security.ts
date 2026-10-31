import { join } from 'node:path';
import { CONFIG_FLAG } from '#cli/config/flags.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { buildConfigFiles } from '#cli/generation/configs.ts';
import { getConfigFileTarget } from '#cli/generation/selection.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { SEMGREP_TOOL, SEMGREP_RULE_EXTENSION } from '#cli/config/checks/general/general.ts';

function listSemgrepRuleFiles(session: Session, planned: PlannedCheck): string[] {
    const { configurations, path: scopePath, settings } = planned.scope;
    const ruleFiles = configurations.flatMap((configuration) =>
        configuration.configFiles
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.target.endsWith(SEMGREP_RULE_EXTENSION))
            .filter((file) => file.level !== 'all' || session.settings.level === 'all')
            .map((file) => getConfigFileTarget(scopePath, file, buildConfigFiles(session))),
    );
    return [...new Set([...ruleFiles, ...getTable(settings, 'tools.semgrep').rule_files])];
}

/**
Runs Semgrep with the rule files of the scope.

@param session the repository and installed tools.
@param planned the check for one scope.
*/
export async function checkSemgrep(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command as string[];
    const rules = listSemgrepRuleFiles(session, planned);
    return runCommandCheck(session, planned, {
        command: [...command, ...rules.flatMap((path) => [CONFIG_FLAG, join(session.root, path)])],
    });
}
