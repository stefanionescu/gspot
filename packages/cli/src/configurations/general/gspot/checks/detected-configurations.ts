import { GSPOT_RULES } from '#cli/config/configurations/structure.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { quoteArgument } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

function formatDetection(name: string): string {
    const owner = readConfigurations().get(name);
    if (owner === undefined || owner.checks.length > 0) return `No check reads ${name}`;
    return `${name} changes the lint rules for this code`;
}

function checkDetectedConfigurations(session: Session, _planned: PlannedCheck): CheckFinding[] {
    return listDetectedAdditions(session).flatMap(({ scopePath, evidence }) => {
        const scopeArgument = scopePath === '' ? '' : ` --scope ${quoteArgument(scopePath)}`;
        return evidence.map(({ configuration, evidence: found }) => ({
            file: SETTINGS_FILE,
            line: 1,
            rule: GSPOT_RULES.detectedConfiguration,
            message: `${formatDetection(configuration)} (${found}). Run gspot add ${configuration}${scopeArgument}, or gspot remove ${configuration}${scopeArgument} --reason "<why>".`,
        }));
    });
}

export const DETECTED_CONFIGURATIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/detected-configurations': { check: checkDetectedConfigurations },
};
