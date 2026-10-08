import { findingAt } from '#cli/checks/finding.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { expandPaths } from '#cli/platform/paths.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { PathPattern } from '#cli/types/checks/general/structure.ts';

function listedPaths(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const paths = entry['paths'];
        return Array.isArray(paths) ? paths.map(String) : [];
    });
}

// Only paths keys are read, so URL patterns such as tools.lychee.exclude_urls are skipped.
function settingPatterns(tools: Record<string, Record<string, unknown>>, prefix: string): PathPattern[] {
    return Object.entries(tools).flatMap(([tool, table]) =>
        Object.entries(table).flatMap(([setting, value]) =>
            listedPaths(value).map((pattern) => ({ pattern, where: `${prefix}${tool}.${setting}` })),
        ),
    );
}

function policyPatterns(input: CheckInput): PathPattern[] {
    const { policy } = input.policyFiles;
    const { naming } = policy;
    return [
        ...policy.ignore.flatMap((entry) => (entry.paths ?? []).map((pattern) => ({ pattern, where: '[[ignore]]' }))),
        ...policy.declarations
            .filter((entry) => entry.kind !== 'generated' || entry.configuration === undefined)
            .flatMap((entry) => entry.paths.map((pattern) => ({ pattern, where: `[[${entry.kind}]]` }))),
        ...listedPaths(naming.overrides).map((pattern) => ({ pattern, where: '[[naming.overrides]]' })),
        ...settingPatterns(policy.tools, 'tools.'),
        ...(policy.configurationSettings === undefined ? [] : settingPatterns(policy.configurationSettings, '')),
    ];
}

/**
 * One finding per policy pattern that matches no tracked file or folder. The policy is one per repository, so the root scope reports.
 * @param input the check input
 * @returns the findings
 */
export function staleAllowlists(input: CheckInput): Finding[] {
    const candidates = [...expandPaths(input.files.map((file) => file.path))];
    return policyPatterns(input)
        .filter((entry) => {
            const matches = pathMatcher([entry.pattern]);
            return !candidates.some((path) => matches(path));
        })
        .map((entry) =>
            findingAt(
                input,
                { file: POLICY_FILE, line: 1 },
                'unmatched-pattern',
                `${entry.pattern} under ${entry.where} matches no tracked file or folder.`,
            ),
        );
}
