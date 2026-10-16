import { readSource } from '#cli/system/files/reads.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

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
 * @param input the check input.
 * @returns the findings.
 */
export function xcconfig(input: CheckInput): Finding[] {
    return sourcePaths(input, [XCCONFIG_SUFFIX]).flatMap((path) =>
        readSource(input.root, path, input.reads)
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
                          findingAt(
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
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeEntitlements(input: CheckInput): Finding[] {
    const allowed = new Set(input.selection.view.options('xcode').allowed_entitlements);
    return sourcePaths(input, [ENTITLEMENTS_SUFFIX]).flatMap((path) => {
        const text = readSource(input.root, path, input.reads).toString('utf8');
        return text
            .matchAll(PLIST_KEY)
            .filter((match) => !allowed.has(match.groups?.['name'] ?? ''))
            .map((match) => {
                const line = text.slice(0, match.index).split('\n').length;
                return findingAt(
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
 * @param input the check input.
 * @returns the findings.
 */
export function xcodeAppTransportSecurity(input: CheckInput): Finding[] {
    return sourcePaths(input, [PLIST_SUFFIX]).flatMap((path): Finding[] => {
        const text = readSource(input.root, path, input.reads).toString('utf8');
        const found = ARBITRARY_LOADS.exec(text);
        if (found === null) return [];
        const line = text.slice(0, found.index).split('\n').length;
        return [
            findingAt(
                input,
                { file: path, line },
                'arbitrary-loads',
                'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.',
            ),
        ];
    });
}
