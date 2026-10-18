import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/repository/matchers.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { SelectorGroup } from '#cli/types/generation/eslint.ts';
import type { SelectorPaths } from '#cli/types/generation/fragments.ts';
import { REEXPORT_SELECTORS } from '#cli/config/generation/eslint-rules.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';
import { ENVIRONMENT_SELECTOR, ESLINT_SETTINGS_TABLE, ALIAS_IMPORT_SELECTORS } from '#cli/config/generation/eslint.ts';

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
function listSettingSelectors(selection: ScopeSelection, isAll: boolean): SelectorPaths[] {
    const selectors: SelectorPaths[] = [];
    const owners = selection.view.values.structure?.environment_readers ?? [];
    if (isAll && owners.length > 0) selectors.push({ ...ENVIRONMENT_SELECTOR, except: owners });
    const styles = selection.view.values[ESLINT_SETTINGS_TABLE]?.import_extension;
    if (styles !== undefined)
        selectors.push({ ...ALIAS_IMPORT_SELECTORS[styles === 'extensionless' ? 'never' : 'always'], except: [] });
    return selectors;
}

// A selector covers the files that its setting lists in the scope, or every source file when it names no setting.
function buildSelectorPaths(selection: ScopeSelection, entry: Manifest['eslint']['selectors'][number]): SelectorPaths {
    const listed = entry.files_setting === undefined ? undefined : selection.view.settings[entry.files_setting];
    const files = entry.files_setting === undefined ? {} : { files: (listed as string[] | undefined) ?? [] };
    return { selector: entry.selector, message: entry.message, ...files, except: [] };
}

/**
 * Resolve the selectors that fragments add in each project scope.
 *
 * @param scopes every project selection.
 * @param isAll whether the house style selectors apply.
 * @param reexports the export convention.
 *
 * @returns selector groups with their owning scope and excluded child projects.
 */
export function groupFragmentSelectors(
    scopes: ScopeSelection[],
    isAll: boolean,
    reexports: Settings['structure']['reexports'],
): SelectorGroup[] {
    const scopePaths = scopes.map((entry) => entry.scope.path);
    return scopes.flatMap((selection) => {
        const prefix = escapeGlob(selection.scope.path);
        const declarations = selection.selected.flatMap((manifest) => (isAll ? manifest.eslint.selectors : []));
        const applied: SelectorPaths[] = [
            ...new Map(declarations.map((entry) => [entry.selector, entry])).values(),
        ].map((entry) => buildSelectorPaths(selection, entry));
        if (isAll) {
            const except = reexports === 'index-only' ? [posix.join(prefix, '**/index.*')] : [];
            applied.push(
                ...REEXPORT_SELECTORS.map((selector) => ({
                    selector,
                    message: 'Export values at their declaration instead of re-exporting them.',
                    except,
                })),
            );
        }
        applied.push(...listSettingSelectors(selection, isAll));
        return groupSelectors(applied).map((group) => ({
            ...group,
            scope: selection.scope.path,
            ignoredScopes: listNestedScopes(scopePaths, selection.scope.path),
        }));
    });
}
