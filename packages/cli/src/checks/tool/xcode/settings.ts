import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { trackedEnding } from '#cli/checks/tool/xcode/project.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { PLIST_KEY, INCLUDE_LINE, SETTING_NAME, ARBITRARY_LOADS } from '#cli/config/checks/tool/xcode.ts';

/**
 * One finding for each xcconfig line that is no setting, no include, and no comment.
 * @param input the engine input
 * @returns the findings
 */
export function xcconfigLines(input: EngineInput): Finding[] {
    return trackedEnding(input, ['.xcconfig']).flatMap((path) =>
        readSource(input.root, path, input.reads)
            .toString('utf8')
            .split('\n')
            .flatMap((raw, index): Finding[] => {
                const line = raw.trim();
                // Conditions in brackets can contain equals signs before the assignment itself.
                const sign = line.indexOf('=', line.lastIndexOf(']') + 1);
                const isSetting = sign > 0 && SETTING_NAME.test(line.slice(0, sign).trim());
                const isFine = line === '' || line.startsWith('//') || isSetting || INCLUDE_LINE.test(line);
                return isFine
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
 * One finding for each entitlement outside tools.xcode.entitlements_allowed. The planner requires a configured list.
 * @param input the engine input
 * @returns the findings
 */
export function entitlementsPolicy(input: EngineInput): Finding[] {
    const allowed = new Set(input.view.tool('xcode')['entitlements_allowed'] as string[] | undefined);
    return trackedEnding(input, ['.entitlements']).flatMap((path) => {
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
 * @param input the engine input
 * @returns the findings
 */
export function transportSecurity(input: EngineInput): Finding[] {
    return trackedEnding(input, ['.plist']).flatMap((path): Finding[] => {
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
