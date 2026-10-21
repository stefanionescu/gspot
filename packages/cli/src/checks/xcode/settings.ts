import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { computePosition } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/covered-files.ts';
import { PLIST_KEY, PLIST_SUFFIX, ENTITLEMENTS_SUFFIX, INSECURE_TRANSPORT_SETTING } from '#cli/config/checks/xcode.ts';

/**
 * Reports each entitlement outside xcode.allowed_entitlements, which planning requires.
 *
 * @param session the repository and its tools.
 * @param planned the scope files and allowed entitlements.
 * @returns the findings.
 */
export function checkXcodeEntitlements(session: Session, planned: PlannedCheck): Finding[] {
    const allowed = new Set(getTable(planned.selection.view, 'xcode').allowed_entitlements);
    return listSourcePaths(planned.files, [ENTITLEMENTS_SUFFIX]).flatMap((path) => {
        const text = readCachedText(session.reads, path);
        return text
            .matchAll(PLIST_KEY)
            .filter((match) => !allowed.has(match.groups?.['name'] ?? ''))
            .map((match) => {
                const line = computePosition(text, match.index).line;
                return buildFinding(
                    planned,
                    { file: path, line },
                    'entitlement',
                    `${match.groups?.['name'] ?? ''} is not an allowed entitlement.`,
                );
            })
            .toArray();
    });
}

/**
 * Reports each plist that turns App Transport Security off for every host.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkAppTransportSecurity(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [PLIST_SUFFIX]).flatMap((path): Finding[] => {
        const text = readCachedText(session.reads, path);
        const found = INSECURE_TRANSPORT_SETTING.exec(text);
        if (found === null) return [];
        const line = computePosition(text, found.index).line;
        return [
            buildFinding(
                planned,
                { file: path, line },
                'arbitrary-loads',
                'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.',
            ),
        ];
    });
}
