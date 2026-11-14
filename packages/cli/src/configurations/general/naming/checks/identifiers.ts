import { getTable } from '#cli/settings/tables.ts';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { buildSyntaxFinding } from '#cli/configurations/syntax.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import { readNamingSettings } from '#cli/configurations/general/naming/checks/settings.ts';
import { IDENTIFIER_EXPLANATIONS } from '#cli/configurations/general/naming/explanations.ts';
import { validateIdentifiers } from '#cli/configurations/general/naming/checks/validation.ts';
import { SQL_SYNTAX_HELP, POSTGRES_PARSER_DIALECTS } from '#cli/config/configurations/naming.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/configurations/general/naming/checks/source-names.ts';

async function checkIdentifiers(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const settings = readNamingSettings(session.settings, planned.scope);
    const findings: CheckFinding[] = [];
    for (const { file, language } of listNamedFiles(planned)) {
        const text = readText(session.cache, file.path);
        const { identifiers, error } = await parseIdentifiers(file.path, text, language, session);
        if (error !== undefined) {
            const isSql = language === 'sql';
            if (!isSql || POSTGRES_PARSER_DIALECTS.has(getTable(planned.scope.settings, 'sql').dialect))
                findings.push({ ...buildSyntaxFinding(file.path, error), ...(isSql && { help: SQL_SYNTAX_HELP }) });
            continue;
        }
        findings.push(...validateIdentifiers(settings, identifiers));
    }
    return findings;
}

export const NAMING_IDENTIFIERS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'naming/identifiers': { check: checkIdentifiers, explanations: IDENTIFIER_EXPLANATIONS },
};
