import type { Session } from '#cli/types/tools.ts';
import { quoteArgument } from '#cli/system/text.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { GSPOT_RULES } from '#cli/config/configurations/structure.ts';

/**
Reports each configuration that the files of a scope suggest and that gspot.toml neither selects nor removes.

@param session the repository and its settings.
@param _planned the configured check and selected scope files.
*/
function checkDetectedConfigurations(session: Session, _planned: PlannedCheck): CheckFinding[] {
    return listDetectedAdditions(session).flatMap(({ scope, evidence }) => {
        const scopeArgument = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
        return evidence.map(({ configuration, evidence: found }) => ({
            file: SETTINGS_FILE,
            line: 1,
            rule: GSPOT_RULES.detectedConfiguration,
            message: `No check reads ${configuration} (${found}). Run gspot add ${configuration}${scopeArgument}, or gspot remove ${configuration}${scopeArgument} --reason "<why>".`,
        }));
    });
}

export const DETECTED_CONFIGURATIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/detected-configurations': { check: checkDetectedConfigurations },
};
