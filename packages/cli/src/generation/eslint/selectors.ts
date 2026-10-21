import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Settings } from '#cli/types/settings/file.ts';
import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';
import type { Level, Configuration } from '#cli/types/configurations.ts';
import { REEXPORT_SELECTORS } from '#cli/config/generation/eslint/rules.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint/tool-settings.ts';
import { type SelectorGroup, type SelectorPaths } from '#cli/types/generation/eslint.ts';
import { ENVIRONMENT_SELECTOR, ALIAS_IMPORT_SELECTORS } from '#cli/config/generation/eslint/selectors.ts';

// Keep each distinct path list once, in the order written.
function filterDistinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Group the selectors that fragments add, so each file set gets one no-restricted-syntax rule.
 *
 * A selector without files applies to every code file. The except paths of a selector leave it out of the groups for
 * those paths. Each intersection of files and except paths makes its own block, with every selector that applies
 * there, in first-mention order.
 *
 * @param selectors the fragment syntax patterns with their covered and skipped paths.
 *
 * @returns the groups, where an absent files list means every code file.
 */
function groupSelectors(selectors: SelectorPaths[]): SelectorGroup[] {
    const boundaries = filterDistinctLists(
        selectors.flatMap((entry) => [entry.files ?? [], entry.except ?? []]).filter((paths) => paths.length > 0),
    );
    let groups: { files: string[][]; ignores: string[]; matched: string[][] }[] = [
        { files: [], ignores: [], matched: [] },
    ];
    for (const paths of boundaries)
        groups = groups.flatMap((group) => [
            {
                files:
                    group.files.length === 0
                        ? paths.map((path) => [path])
                        : group.files.flatMap((parts) => paths.map((path) => [...parts, path])),
                ignores: group.ignores,
                matched: [...group.matched, paths],
            },
            { ...group, ignores: [...group.ignores, ...paths] },
        ]);
    return groups.map((group) => ({
        ...(group.files.length === 0 ? {} : { files: group.files }),
        ...(group.ignores.length === 0 ? {} : { ignores: group.ignores }),
        selectors: selectors
            .filter(
                (entry) =>
                    (entry.files === undefined ||
                        group.matched.some((paths) => isDeepStrictEqual(paths, entry.files))) &&
                    (entry.except === undefined ||
                        !group.matched.some((paths) => isDeepStrictEqual(paths, entry.except))),
            )
            .map((entry) => ({ selector: entry.selector, message: entry.message })),
    }));
}

// The selectors that settings turn on: environment reads outside the readers at level all, and alias suffixes.
function listSettingSelectors(scope: Scope, level: Level): SelectorPaths[] {
    const selectors: SelectorPaths[] = [];
    const owners = scope.settings.values.structure?.environment_readers ?? [];
    if (level === 'all' && owners.length > 0) selectors.push({ ...ENVIRONMENT_SELECTOR, except: owners });
    const styles = scope.settings.values[ESLINT_SETTINGS_TABLE]?.import_extension;
    if (styles !== undefined)
        selectors.push({ ...ALIAS_IMPORT_SELECTORS[styles === 'extensionless' ? 'never' : 'always'], except: [] });
    return selectors;
}

// A selector covers the files that its setting lists in the scope, or every source file when it names no setting.
function buildSelectorPaths(scope: Scope, entry: Configuration['eslint']['selectors'][number]): SelectorPaths {
    const listed = entry.paths_setting === undefined ? undefined : scope.settings.settings[entry.paths_setting];
    const files = entry.paths_setting === undefined ? {} : { files: (listed as string[] | undefined) ?? [] };
    return { selector: entry.selector, message: entry.message, ...files, except: [] };
}

/**
 * Resolve the selectors that fragments add in each project scope.
 *
 * @param scopes every project selection.
 * @param level the selected lint rule level.
 * @param reexports the export convention.
 *
 * @returns selector groups with their owning scope and excluded child projects.
 */
export function buildSelectorGroups(
    scopes: Scope[],
    level: Level,
    reexports: Settings['structure']['reexports'],
): SelectorGroup[] {
    const scopePaths = scopes.map((entry) => entry.folder.path);
    return scopes.flatMap((scope) => {
        const prefix = scope.folder.path.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH);
        const declarations = scope.configurations.flatMap((configuration) =>
            level === 'all' ? configuration.eslint.selectors : [],
        );
        const applied: SelectorPaths[] = [
            ...new Map(declarations.map((entry) => [entry.selector, entry])).values(),
        ].map((entry) => buildSelectorPaths(scope, entry));
        if (level === 'all') {
            const except = reexports === 'index-only' ? [posix.join(prefix, '**/index.*')] : [];
            applied.push(...REEXPORT_SELECTORS.map((selector) => ({ ...selector, except })));
        }
        applied.push(...listSettingSelectors(scope, level));
        return groupSelectors(applied).map((group) => ({
            ...group,
            scope: scope.folder.path,
            ignoredScopes: listNestedScopes(scopePaths, scope.folder.path),
        }));
    });
}
