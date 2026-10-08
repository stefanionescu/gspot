import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { scopeSourcesByEnding } from '#cli/checks/tool/xcode/project.ts';
import { PLIST_KEY, INCLUDE_LINE, SETTING_NAME, ARBITRARY_LOADS } from '#cli/config/checks/tool/xcode.ts';

/**
 * One finding for each xcconfig line that is no setting, no include, and no comment.
 * @param input the check input
 * @returns the findings
 */
export function xcconfig(input: CheckInput): Finding[] {
    return scopeSourcesByEnding(input, ['.xcconfig']).flatMap((path) =>
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
                              'This line is no KEY = value setting, no #include, and no comment.',
                          ),
                      ];
            }),
    );
}

/**
 * One finding for each entitlement outside xcode.entitlements_allowed. The planner requires a configured list.
 * @param input the check input
 * @returns the findings
 */
export function entitlements(input: CheckInput): Finding[] {
    const allowed = new Set(input.view.options('xcode').entitlements_allowed);
    return scopeSourcesByEnding(input, ['.entitlements']).flatMap((path) => {
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
 * @param input the check input
 * @returns the findings
 */
export function ats(input: CheckInput): Finding[] {
    return scopeSourcesByEnding(input, ['.plist']).flatMap((path): Finding[] => {
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
