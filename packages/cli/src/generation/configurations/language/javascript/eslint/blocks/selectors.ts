import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/system/paths.ts';
import type { Level } from '#cli/types/configurations.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { type SelectorBlock, type SelectorPaths } from '#cli/types/generation/eslint.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

import {
    INDEX_PATTERN,
    REEXPORT_MESSAGE,
    REEXPORT_SELECTORS,
    ENVIRONMENT_SELECTOR,
    ALIAS_IMPORT_SELECTORS,
} from '#cli/config/generation/configurations/language/javascript/eslint/blocks/selectors.ts';

function filterDistinctLists(lists: string[][]): string[][] {
    const seen = new Set<string>();
    return lists.filter((list) => {
        const key = JSON.stringify(list);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function groupSelectors(selectors: SelectorPaths[]): SelectorBlock[] {
    const boundaries = filterDistinctLists(
        selectors.flatMap((each) => [each.files ?? [], each.except ?? []]).filter((paths) => paths.length > 0),
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
                        : group.files.flatMap((fileList) => paths.map((path) => [...fileList, path])),
                ignores: group.ignores,
                matched: [...group.matched, paths],
            },
            { ...group, ignores: [...group.ignores, ...paths] },
        ]);
    return groups.map((group) => ({
        ...(group.files.length > 0 && { files: group.files }),
        ...(group.ignores.length > 0 && { ignores: group.ignores }),
        selectors: selectors
            .filter(
                (each) =>
                    (each.files === undefined || group.matched.some((paths) => isDeepStrictEqual(paths, each.files))) &&
                    (each.except === undefined ||
                        group.matched.every((paths) => !isDeepStrictEqual(paths, each.except))),
            )
            .map((each) => ({ selector: each.selector, message: each.message })),
    }));
}

function listSettingSelectors(scope: Scope, level: Level): SelectorPaths[] {
    const selectors: SelectorPaths[] = [];
    const owners = scope.settings.tables.structure?.environment_readers ?? [];
    if (level === 'all' && owners.length > 0) selectors.push({ ...ENVIRONMENT_SELECTOR, except: owners });
    const importExtension = scope.settings.tables[ESLINT_SETTINGS_TABLE]?.import_extension;
    if (importExtension !== undefined)
        selectors.push({
            ...ALIAS_IMPORT_SELECTORS[importExtension === 'extensionless' ? 'never' : 'always'],
            except: [],
        });
    return selectors;
}

/**
Resolve the syntax selectors that the configurations and settings add in each project scope.

@param scopes every project scope.
@param level the selected lint rule level.
@param reexports the export convention.
*/
export function buildSelectorBlocks(
    scopes: Scope[],
    level: Level,
    reexports: Settings['structure']['reexports'],
): SelectorBlock[] {
    const scopePaths = scopes.map((each) => each.path);
    return scopes.flatMap((scope) => {
        const prefix = escapeGlob(scope.path);
        const declarations = scope.configurations.flatMap((configuration) =>
            configuration.eslint.selectors.filter((selector) => level === 'all' || selector.level === 'basic'),
        );
        const applied: SelectorPaths[] = new Map(declarations.map((declaration) => [declaration.selector, declaration]))
            .values()
            .map(
                (declaration): SelectorPaths => ({
                    selector: declaration.selector,
                    message: declaration.message,
                    ...(declaration.paths_setting !== undefined && {
                        files: (scope.settings.valuesByKey[declaration.paths_setting] as string[] | undefined) ?? [],
                    }),
                    except: [],
                }),
            )
            .toArray();
        if (level === 'all') {
            const except = reexports === 'index-only' ? [posix.join(prefix, INDEX_PATTERN)] : [];
            applied.push(...REEXPORT_SELECTORS.map((selector) => ({ selector, message: REEXPORT_MESSAGE, except })));
        }
        applied.push(...listSettingSelectors(scope, level));
        return groupSelectors(applied).map((group) => ({
            ...group,
            scope: scope.path,
            ignoredScopes: listNestedScopes(scopePaths, scope.path),
        }));
    });
}
