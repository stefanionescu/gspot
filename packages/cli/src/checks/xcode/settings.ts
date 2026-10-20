import { buildFinding } from '#cli/runs/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import { PLIST_KEY, PLIST_SUFFIX, ARBITRARY_LOADS, ENTITLEMENTS_SUFFIX } from '#cli/config/checks/xcode.ts';

/**
 * Reports each entitlement outside xcode.allowed_entitlements, which planning requires.
 *
 * @param input the scope files and allowed entitlements.
 * @returns the findings.
 */
export function checkXcodeEntitlements(input: CheckInput): Finding[] {
    const allowed = new Set(input.selection.view.options('xcode').allowed_entitlements);
    return listSourcePaths(input.files, [ENTITLEMENTS_SUFFIX]).flatMap((path) => {
        const text = readCachedBytes(input.reads, path).toString('utf8');
        return text
            .matchAll(PLIST_KEY)
            .filter((match) => !allowed.has(match.groups?.['name'] ?? ''))
            .map((match) => {
                const line = computePosition(text, match.index).line;
                return buildFinding(
                    input,
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
 * @param input the scope files to read.
 * @returns the findings.
 */
export function checkAppTransportSecurity(input: CheckInput): Finding[] {
    return listSourcePaths(input.files, [PLIST_SUFFIX]).flatMap((path): Finding[] => {
        const text = readCachedBytes(input.reads, path).toString('utf8');
        const found = ARBITRARY_LOADS.exec(text);
        if (found === null) return [];
        const line = computePosition(text, found.index).line;
        return [
            buildFinding(
                input,
                { file: path, line },
                'arbitrary-loads',
                'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.',
            ),
        ];
    });
}
