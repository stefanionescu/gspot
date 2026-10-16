import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { nestedScopes } from '#cli/repository/scopes.ts';
import { literalGlob } from '#cli/repository/selectors.ts';
import type { SelectorGroup } from '#cli/types/generation/eslint.ts';
import type { SelectorPaths } from '#cli/types/generation/fragments.ts';
import { REEXPORT_SELECTORS } from '#cli/config/generation/eslint-rules.ts';
import type { Settings, ScopeSelection } from '#cli/types/settings/values.ts';
import { ENVIRONMENT_SELECTOR, ESLINT_SETTINGS_TABLE, ALIAS_IMPORT_SELECTORS } from '#cli/config/generation/eslint.ts';

// The paths a loosening setting allows: every entry's paths, in the order written.
function distinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Groups the selectors the selected fragments add so each file set gets one no-restricted-syntax rule.
 *
 * A selector without files applies to every code file. Exclude a selector with an allowed setting from the group for
 * the paths that setting names. File and allowed-path intersections produce exclusive blocks,
 * each retaining every selector that applies there in first-mention order.
 *
 * @param selectors the selectors of the selected fragments, with the paths their allowed settings hold.
 *
 * @returns the groups, where an absent files list means every code file.
 */
function selectorGroups(selectors: SelectorPaths[]): SelectorGroup[] {
    const boundaries = distinctLists(
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

/**
 * Resolve the actual selectors contributed by selected fragments within each project scope.
 *
 * @param scopes every selected project scope.
 * @param isAll whether house style selectors apply.
 * @param reexports the selected export convention.
 *
 * @returns selector groups with their owning scope and excluded child projects.
 */
export function fragmentSelectorGroups(
    scopes: ScopeSelection[],
    isAll: boolean,
    reexports: Settings['structure']['reexports'],
): SelectorGroup[] {
    const scopePaths = scopes.map((entry) => entry.scope.path);
    return scopes.flatMap((scope) => {
        const prefix = literalGlob(scope.scope.path);
        const declarations = scope.selected.flatMap((manifest) => (isAll ? manifest.eslint.selectors : []));
        const applied: SelectorPaths[] = [
            ...new Map(declarations.map((entry) => [entry.selector, entry])).values(),
        ].map((entry) => {
            const files =
                entry.role === undefined
                    ? undefined
                    : Object.entries(scope.view.roles).flatMap(([name, paths]) => (name === entry.role ? paths : []));
            return {
                selector: entry.selector,
                message: entry.message,
                ...(files === undefined ? {} : { files }),
                except: [],
            };
        });
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
        const owners = scope.view.roles.environment_readers;
        if (isAll && owners.length > 0) applied.push({ ...ENVIRONMENT_SELECTOR, except: owners });
        const styles = scope.view.values[ESLINT_SETTINGS_TABLE]?.import_extension;
        if (styles !== undefined)
            applied.push({
                ...ALIAS_IMPORT_SELECTORS[styles === 'extensionless' ? 'never' : 'always'],
                except: [],
            });
        return selectorGroups(applied).map((group) => ({
            ...group,
            scope: scope.scope.path,
            ignoredScopes: nestedScopes(scopePaths, scope.scope.path),
        }));
    });
}
