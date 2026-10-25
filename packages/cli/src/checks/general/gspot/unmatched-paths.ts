import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { findSettingLine } from '#cli/settings/file.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { mapSettingPaths } from '#cli/settings/paths.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { type PathVisitor } from '#cli/types/settings/inheritance.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { GROUP_HELP, UNESCAPED_GROUP, NEGATED_PATTERN } from '#cli/config/checks/general/gspot/unmatched-paths.ts';

/**
Reports setting paths that match no tracked file or folder.

@param session the repository and its tools.
@param planned the settings and tracked files.
@returns the findings.
*/
export function checkGspotUnmatchedPaths(session: Session, planned: PlannedCheck): Finding[] {
    const files = session.repository.files;
    const repositoryPaths = [...includeParentFolders(files.map((file) => file.path))];
    return listSettingsTables(session.settingsFile.settings).flatMap(({ table, scope = '', path }) => {
        const findings: Finding[] = [];
        const schema = scope === '' ? settingsSchema : scopeSchema;
        const visit: PathVisitor = (pattern, keys, role) => {
            const matches = buildPathMatcher([pattern.replace(NEGATED_PATTERN, '')]);
            if (role === 'source' && repositoryPaths.every((repositoryPath) => !matches(repositoryPath))) {
                const names = keys
                    .filter((field): field is string => typeof field === 'string')
                    .filter((field, index, fields) => field !== 'paths' || index !== fields.length - 1);
                const key = [...path, ...names].join('.');
                const written = getValueAt(table.written, names);
                const where =
                    Array.isArray(written) && written.some((element) => isTable(element)) ? `[[${key}]]` : key;
                findings.push(
                    buildFinding(
                        planned,
                        {
                            file: SETTINGS_FILE,
                            line: findSettingLine(session.settingsFile, [...path, ...keys]),
                        },
                        'unmatched-path',
                        `${pattern} under ${where} matches no tracked file or folder.${UNESCAPED_GROUP.test(pattern) ? GROUP_HELP : ''}`,
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
