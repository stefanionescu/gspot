import { buildFinding } from '#cli/checks/finding.ts';
import { computePosition } from '#cli/system/text.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';

import {
    PLIST_KEY,
    INCLUDE_LINE,
    PLIST_SUFFIX,
    SETTING_NAME,
    ARBITRARY_LOADS,
    XCCONFIG_SUFFIX,
    ENTITLEMENTS_SUFFIX,
} from '#cli/config/checks/infrastructure/xcode.ts';

/**
 * One finding for each invalid xcconfig line.
 * @param input the configuration file paths and cached line reads.
 * @returns the findings.
 */
export function checkXcconfig(input: CheckInput): Finding[] {
    return listSourcePaths(input.files, [XCCONFIG_SUFFIX]).flatMap((path) =>
        readCachedBytes(input.reads, path)
            .toString('utf8')
            .split('\n')
            .flatMap((raw, index): Finding[] => {
                const line = raw.trim();
                // Conditions in brackets can contain equals signs before the assignment itself.
                const sign = line.indexOf('=', line.lastIndexOf(']') + 1);
                const isSetting = sign > 0 && SETTING_NAME.test(line.slice(0, sign).trim());
                const isValid = line === '' || line.startsWith('//') || isSetting || INCLUDE_LINE.test(line);
                return isValid
                    ? []
                    : [
                          buildFinding(
                              input,
                              { file: path, line: index + 1 },
                              'xcconfig-line',
                              'Write this line as KEY = value.',
                          ),
                      ];
            }),
    );
}

/**
 * One finding for each entitlement outside xcode.allowed_entitlements. The planner requires a configured list.
 * @param input the plist files and settings that list permitted keys.
 * @returns the findings.
 */
export function checkXcodeEntitlements(input: CheckInput): Finding[] {
    const allowed = new Set(input.scope.view.options('xcode').allowed_entitlements);
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
 * One finding for each plist that turns App Transport Security off for every host.
 * @param input the plist paths and file reads that expose global transport exceptions.
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
