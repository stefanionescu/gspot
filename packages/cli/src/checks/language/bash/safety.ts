import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readScripts } from '#cli/checks/language/bash/scripts.ts';
import { SAFETY_PATTERNS, ALL_LEVEL_SAFETY_PATTERNS } from '#cli/config/checks/language/bash/safety.ts';

/**
 * Reports each unsafe process kill or removal, and at level `all`, each discarded failure.
 *
 * @param session the repository and its tools.
 * @param planned the scope scripts and level.
 * @returns the findings.
 */
export async function checkBashSafety(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const rules = [
        ...(session.settingsFile.settings.level === 'all' ? ALL_LEVEL_SAFETY_PATTERNS : []),
        ...SAFETY_PATTERNS,
    ];
    const scripts = await readScripts(session, planned);
    return scripts.flatMap((file) =>
        file.code.flatMap((code, position) => {
            const isCleanup = file.temporaryPaths.some((temporary) => temporary.cleanupLines.includes(position + 1));
            return rules
                .filter(([pattern]) => pattern.test(code))
                .filter(([, rule]) => rule !== 'recursive-remove' || !isCleanup)
                .map(([, rule, text]) => buildFinding(planned, { file: file.path, line: position + 1 }, rule, text));
        }),
    );
}
