import type { Session } from '#cli/types/tools.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { findSettingLine, readSettingsText } from '#cli/settings/file.ts';
import type { PathVisitor, SettingLocation } from '#cli/types/settings.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { mapSettingPaths, joinScopeSelector } from '#cli/settings/paths.ts';
import { GSPOT_RULES, BRACKET_HELP, NEGATED_PATTERN, UNESCAPED_BRACKET } from '#cli/config/configurations/structure.ts';

/**
Reports setting paths that match no tracked file or folder.

@param session the repository and its tools.
@param _planned the configured check and selected scope files.
*/
function checkUnmatchedPaths(session: Session, _planned: PlannedCheck): CheckFinding[] {
    const files = session.repository.files;
    const repositoryPaths = [...includeParentFolders(files.map((file) => file.path))];
    const { text } = readSettingsText(session.root);
    return listSettingsTables(session.settings).flatMap(({ table, scopePath = '', path }) => {
        const sources: Array<{ pattern: string; selector: string; location: SettingLocation }> = [];
        const visit: PathVisitor = (pattern, location, role) => {
            const selector = location.keys[0] === 'path' ? pattern : joinScopeSelector(pattern, scopePath);
            if (role === 'source') sources.push({ pattern, selector, location });
            return pattern;
        };
        const settings = Object.entries(table.written).filter(([key]) => key !== 'scope');
        mapSettingPaths(scopePath === '' ? settingsSchema : scopeSchema, Object.fromEntries(settings), visit, {
            keys: [],
            names: [],
        });
        const unmatched = new Set(
            [...new Set(sources.map(({ selector }) => selector))].filter((selector) => {
                const isMatched = buildPathMatcher([selector.replace(NEGATED_PATTERN, '')]);
                return repositoryPaths.every((repositoryPath) => !isMatched(repositoryPath));
            }),
        );
        return sources
            .filter(({ selector }) => unmatched.has(selector))
            .map(({ pattern, selector, location: { keys, names } }) => {
                const key = [...path, ...names].join('.');
                const written = findValueAt(table.written, names);
                const where =
                    Array.isArray(written) && written.some((element) => isTable(element)) ? `[[${key}]]` : key;
                return {
                    file: SETTINGS_FILE,
                    line: findSettingLine(text, session.settings.written, [...path, ...keys]),
                    rule: GSPOT_RULES.unmatchedPath,
                    message: `${selector} under ${where} matches no tracked file or folder.${UNESCAPED_BRACKET.test(pattern) ? BRACKET_HELP : ''}`,
                };
            });
    });
}

export const GSPOT_UNMATCHED_PATHS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/unmatched-paths': { check: checkUnmatchedPaths },
};
