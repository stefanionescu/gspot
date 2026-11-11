import {
    ALIAS_IMPORT_SELECTORS,
    BASE_SELECTORS,
    ENVIRONMENT_SELECTOR,
} from '#cli/config/configurations/eslint/blocks.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import type { SelectorBlock, SelectorPaths } from '#cli/types/configurations/language.ts';
import type { Level, Scope } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

function listSettingSelectors(scope: Scope, level: Level): SelectorPaths[] {
    const selectors: SelectorPaths[] = [];
    const owners = scope.settings.tables.structure?.environment_readers ?? [];
    if (level === 'all' && owners.length > 0) selectors.push({ ...ENVIRONMENT_SELECTOR, ignores: owners });
    const importExtension = scope.settings.tables.javascript?.import_extension;
    if (importExtension !== undefined)
        selectors.push(ALIAS_IMPORT_SELECTORS[importExtension === 'extensionless' ? 'never' : 'always']);
    return selectors;
}

/**
Resolve the syntax selectors of each project scope: the base selectors at level all, the selectors of its
configurations, and those of its settings. A later ESLint block replaces the options of a rule instead of merging them.
Each scope gets one list, and gspot/restricted-syntax matches the files of each selector itself.
*/
export function buildSelectorBlocks(
    scopes: Scope[],
    level: Level,
    dependencyFiles: Session['repository']['dependencyFiles'],
): SelectorBlock[] {
    const scopePaths = scopes.map((each) => each.path);
    return scopes.map((scope) => {
        const installed = new Set(listProjectDependencyNames(dependencyFiles, scope.path));
        const declarations = scope.configurations
            .flatMap((configuration) => configuration.eslint.selectors)
            .filter(
                (selector) =>
                    (level === 'all' || selector.level === 'basic') &&
                    (selector.dependencies.length === 0 || !installed.isDisjointFrom(new Set(selector.dependencies))),
            );
        const applied = new Map(declarations.map((declaration) => [declaration.selector, declaration]))
            .values()
            .map((declaration): SelectorPaths => {
                const { selector, message, files, paths_setting: setting } = declaration;
                if (setting === undefined) return { selector, message, ...(files !== undefined && { files }) };
                const value = scope.settings.valuesByKey[setting] as string | string[] | undefined;
                return {
                    selector,
                    message,
                    files: typeof value === 'string' ? [`${escapeGlob(value)}/**`] : (value ?? []),
                };
            })
            .filter(({ files }) => files === undefined || files.length > 0)
            .toArray();
        return {
            scopePath: scope.path,
            ignoredScopes: listNestedScopes(scopePaths, scope.path),
            selectors: [...(level === 'all' ? BASE_SELECTORS : []), ...applied, ...listSettingSelectors(scope, level)],
        };
    });
}
