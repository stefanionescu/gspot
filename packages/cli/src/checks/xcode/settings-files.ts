import { readSource } from '#cli/repository/tracked.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { trackedEnding, xcodeFinding } from '#cli/checks/xcode/project.ts';

const SETTING_NAME = /^[A-Za-z_][\w.[\]=*,-]*$/u;
const INCLUDE_LINE = /^#include\??\s+"[^"]+"$/u;
const PLIST_KEY = /<key>(?<name>[^<]+)<\/key>/gu;
const ARBITRARY_LOADS = /<key>NSAllowsArbitraryLoads<\/key>\s*<true\s*\/>/u;

// A setting is a name, which may carry conditions in brackets, then an equals sign outside the brackets.
function isSetting(line: string): boolean {
    const sign = line.indexOf('=', line.lastIndexOf(']') + 1);
    return sign > 0 && SETTING_NAME.test(line.slice(0, sign).trim());
}

/**
 * One finding for each xcconfig line that is no setting, no include and no comment.
 * @param input the engine input
 * @returns the findings
 */
export function xcconfigLines(input: EngineInput): Finding[] {
    return trackedEnding(input, ['.xcconfig']).flatMap((path) =>
        readSource(input.root, path, input.observations)
            .toString('utf8')
            .split('\n')
            .flatMap((raw, index): Finding[] => {
                const line = raw.trim();
                const isFine = line === '' || line.startsWith('//') || isSetting(line) || INCLUDE_LINE.test(line);
                return isFine
                    ? []
                    : [
                          xcodeFinding(
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
        const text = readSource(input.root, path, input.observations).toString('utf8');
        return text
            .matchAll(PLIST_KEY)
            .filter((match) => !allowed.has(match.groups?.['name'] ?? ''))
            .map((match) => {
                const line = text.slice(0, match.index).split('\n').length;
                return xcodeFinding(
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
        const text = readSource(input.root, path, input.observations).toString('utf8');
        const found = ARBITRARY_LOADS.exec(text);
        if (found === null) return [];
        const line = text.slice(0, found.index).split('\n').length;
        return [
            xcodeFinding(
                input,
                { file: path, line },
                'arbitrary-loads',
                'NSAllowsArbitraryLoads is true, so every host may be reached without TLS.',
            ),
        ];
    });
}
