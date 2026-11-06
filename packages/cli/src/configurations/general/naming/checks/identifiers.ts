import { SYNTAX_RULE } from '#cli/config/configurations/infrastructure.ts';
import { readNamingSettings } from '#cli/configurations/general/naming/checks/settings.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/configurations/general/naming/checks/source-names.ts';
import { validateIdentifiers } from '#cli/configurations/general/naming/checks/validation.ts';
import { IDENTIFIER_EXPLANATIONS } from '#cli/configurations/general/naming/explanations.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { Session } from '#cli/types/tools.ts';

async function checkIdentifiers(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const settings = readNamingSettings(session.settings, planned.scope);
    const findings: CheckFinding[] = [];
    for (const { file, language } of listNamedFiles(planned)) {
        const text = readText(session.cache, file.path);
        const { identifiers, error } = await parseIdentifiers(file.path, text, language, session);
        if (error !== undefined) {
            findings.push({
                file: file.path,
                line: error.line,
                column: error.column,
                rule: SYNTAX_RULE,
                message: error.text,
            });
            continue;
        }
        findings.push(...validateIdentifiers(planned, settings, identifiers));
    }
    return findings;
}

export const NAMING_IDENTIFIERS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'naming/identifiers': { check: checkIdentifiers, explanations: IDENTIFIER_EXPLANATIONS },
};
