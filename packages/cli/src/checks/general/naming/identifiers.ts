import { read } from '#cli/system/files/reads.ts';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { validateIdentifiers } from '#cli/checks/general/naming/validation.ts';
import { SYNTAX_RULE } from '#cli/config/checks/cross-configuration/syntax.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/checks/general/naming/source-names.ts';

/**
Checks the names that source files declare.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export async function checkNamingIdentifiers(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const settings = readNamingSettings(session.settings, planned.scope);
    const findings: CheckFinding[] = [];
    for (const { file, language } of listNamedFiles(planned)) {
        const text = read(session.reads, file.path);
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
