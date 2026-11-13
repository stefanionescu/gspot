import { BRACKET_HELP, GSPOT_RULES, NEGATED_PATTERN, UNESCAPED_BRACKET } from '#cli/config/configurations/gspot.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { readSettingsText } from '#cli/settings/toml/file.ts';
import { findSettingLine } from '#cli/settings/toml/text.ts';
import { joinScopeSelector, mapSettingPaths } from '#cli/settings/values/paths.ts';
import { listSettingsTables } from '#cli/settings/values/written.ts';
import { includeParentFolders } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { PathVisitor, SettingLocation } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

/**
Name the scope-relative form of a pattern that starts at the repository root. The pattern qualifies only when it
matches a tracked path from the root, so a pattern with a plain typo keeps the short message.
*/
function formatScopeHelp(pattern: string, scopePath: string, repositoryPaths: readonly string[]): string {
    const fromRoot = pattern.replace(NEGATED_PATTERN, '');
    if (scopePath === '' || !fromRoot.startsWith(`${scopePath}/`)) return '';
    const isMatched = buildPathMatcher([fromRoot]);
    if (!repositoryPaths.some((repositoryPath) => isMatched(repositoryPath))) return '';
    const written = pattern.replace(`${scopePath}/`, '');
    return ` A path in a [[scope]] table is relative to that scope, so write ${JSON.stringify(written)}.`;
}

function checkUnmatchedPaths(session: Session, _planned: PlannedCheck): CheckFinding[] {
    const files = session.repository.files;
    const repositoryPaths = [...includeParentFolders(files.map((file) => file.path))];
    const { text } = readSettingsText(session.root);
    return listSettingsTables(session.settings).flatMap(({ table, scopePath, path }) => {
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
                    message: `${selector} under ${where} matches no tracked file or folder.${
                        keys[0] === 'path' ? '' : formatScopeHelp(pattern, scopePath, repositoryPaths)
                    }${UNESCAPED_BRACKET.test(pattern) ? BRACKET_HELP : ''}`,
                };
            });
    });
}

export const GSPOT_UNMATCHED_PATHS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'gspot/unmatched-paths': { check: checkUnmatchedPaths },
};
