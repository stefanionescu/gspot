import { join } from 'node:path';

import { SEMGREP_RULE_EXTENSION, SEMGREP_TOOL } from '#cli/config/configurations/general.ts';
import { CONFIG_FLAG } from '#cli/config/tools/installers.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { getConfigTarget } from '#cli/engine/tool-runs/placeholders.ts';
import { getTable } from '#cli/settings/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';

function listSemgrepRuleFiles(session: CheckSession, planned: PlannedCheck): string[] {
    const { configurations, path: scopePath, settings } = planned.scope;
    const ruleFiles = configurations.flatMap((configuration) =>
        configuration.configs
            .filter((file) => file.tool.includes(SEMGREP_TOOL) && file.target.endsWith(SEMGREP_RULE_EXTENSION))
            .filter((file) => file.level !== 'all' || session.settings.level === 'all')
            .map((file) => getConfigTarget(scopePath, file, session.generation.buildConfigs(session))),
    );
    return [...new Set([...ruleFiles, ...getTable(settings, 'security').semgrep_rules])];
}

async function checkSemgrep(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const command = planned.check.command as string[];
    const rules = listSemgrepRuleFiles(session, planned);
    return runCommandCheck(session, planned, {
        command: [...command, ...rules.flatMap((path) => [CONFIG_FLAG, join(session.root, path)])],
    });
}

export const SECURITY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'security/semgrep': { run: checkSemgrep },
};
