import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { validateIdentifiers } from '#cli/checks/general/naming/rules.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/checks/general/naming/source-names.ts';

/**
 * Checks the names that source files declare.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export async function checkNamingIdentifiers(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const settings = readNamingSettings(session.settingsFile.settings, planned.scope);
    const findings: Finding[] = [];
    for (const { file, language } of listNamedFiles(planned)) {
        const text = readCachedText(session.reads, file.path);
        const { identifiers, error } = await parseIdentifiers(file.path, text, language, session);
        if (error !== undefined) continue;
        findings.push(...validateIdentifiers(planned, settings, identifiers));
    }
    return findings;
}
