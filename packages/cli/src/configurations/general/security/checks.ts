import { join } from 'node:path';

import { SEMGREP_TOOL } from '#cli/config/configurations/general.ts';
import { CONFIG_FLAG } from '#cli/config/tools/installers.ts';
import { assertCommandCheck } from '#cli/engine/plan.ts';
import { listLocalRuleConfigs } from '#cli/engine/skips.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { getConfigTarget } from '#cli/engine/tool-runs/placeholders.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckSession } from '#cli/types/engine/run.ts';

function listSemgrepRuleFiles(session: CheckSession, planned: PlannedCheck): string[] {
    const { scope } = planned;
    const configs = session.generation.buildConfigs(session);
    const ruleFiles = listLocalRuleConfigs(scope, session.settings.level, SEMGREP_TOOL).map((file) =>
        getConfigTarget(scope.path, file, configs),
    );
    return [...new Set([...ruleFiles, ...getTable(scope.settings, 'security').semgrep_rules])];
}

async function checkSemgrep(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    assertCommandCheck(planned);
    const rules = listSemgrepRuleFiles(session, planned);
    return runCommandCheck(session, planned, {
        command: [...planned.check.command, ...rules.flatMap((path) => [CONFIG_FLAG, join(session.root, path)])],
    });
}

export const SECURITY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'security/semgrep': { run: checkSemgrep },
};
