import { GSPOT_RULES } from '#cli/config/configurations/gspot.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { stripIgnoredFiles } from '#cli/engine/files.ts';
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { quoteArgument } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/tools.ts';

function formatDetection({ name, checks }: Configuration): string {
    if (checks.length > 0) return `No check reads ${name}`;
    return `${name} changes the lint rules for this code`;
}

/**
Report the configurations that the files suggest. A file that an ignore with paths and no rule covers is no evidence,
because no check reads it.
*/
function checkDetectedConfigurations(session: Session, planned: PlannedCheck): CheckFinding[] {
    const { files } = stripIgnoredFiles(session.repository.files, planned.check, planned.scope);
    const repository = { ...session.repository, files };
    return listDetectedAdditions({ ...session, repository }).flatMap(({ scopePath, evidence }) => {
        const scopeArgument = scopePath === '' ? '' : ` --scope ${quoteArgument(scopePath)}`;
        return evidence.map(({ configuration, evidence: found }) => ({
            file: SETTINGS_FILE,
            line: 1,
            rule: GSPOT_RULES.detectedConfiguration,
            message: `${formatDetection(configuration)} (${found}). Run gspot add ${configuration.name}${scopeArgument}, or gspot remove ${configuration.name}${scopeArgument} --reason "<why>".`,
        }));
    });
}

export const DETECTED_CONFIGURATIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/detected-configurations': { check: checkDetectedConfigurations },
};
