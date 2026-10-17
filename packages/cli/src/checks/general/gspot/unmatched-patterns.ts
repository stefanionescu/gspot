import { buildFinding } from '#cli/checks/finding.ts';
import { mapSettingPaths } from '#cli/settings/paths.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { type PathVisitor } from '#cli/types/settings/values.ts';
import { NEGATED_PATTERN } from '#cli/config/checks/general/gspot.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { scopeSchema, settingsSchema } from '#cli/settings/schema/gspot-toml.ts';

/**
 * Reports setting paths that match no tracked file or folder.
 * @param input the settings and tracked files.
 * @returns the findings.
 */
export function checkUnmatchedPatterns(input: CheckInput): Finding[] {
    const files = input.repositoryFiles;
    const candidates = [...includeParentFolders(files.map((file) => file.path))];
    return listSettingsTables(input.settingsFile.settings).flatMap(({ table, scope = '', path }) => {
        const findings: Finding[] = [];
        const schema = scope === '' ? settingsSchema : scopeSchema;
        const visit: PathVisitor = (pattern, keys, role) => {
            const matches = buildPathMatcher([pattern.replace(NEGATED_PATTERN, '')]);
            if (role === 'source' && !candidates.some((candidate) => matches(candidate))) {
                const names = keys
                    .filter((part): part is string => typeof part === 'string')
                    .filter((part, index, fields) => part !== 'paths' || index !== fields.length - 1);
                const key = [...path, ...names].join('.');
                const written = getValueAt(table.written, names);
                const where = Array.isArray(written) && written.some((entry) => isRecord(entry)) ? `[[${key}]]` : key;
                findings.push(
                    buildFinding(
                        input,
                        { file: SETTINGS_FILE, line: 1 },
                        'unused-record',
                        `${pattern} under ${where} matches no tracked file or folder.`,
                    ),
                );
            }
            return pattern;
        };
        mapSettingPaths(
            schema,
            Object.fromEntries(
                Object.entries(table.written)
                    .filter(([key]) => key !== 'scope')
                    .toSorted(([left], [right]) => Number(right === 'ignore') - Number(left === 'ignore')),
            ),
            visit,
            [],
        );
        return findings;
    });
}
