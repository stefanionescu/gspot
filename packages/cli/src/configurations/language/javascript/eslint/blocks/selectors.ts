import type { Level, Scope } from '#cli/types/settings.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/configurations/javascript.ts';
import type { SelectorBlock, SelectorPaths } from '#cli/types/configurations/language.ts';
import { BASE_SELECTORS, ENVIRONMENT_SELECTOR, ALIAS_IMPORT_SELECTORS } from '#cli/config/configurations/blocks.ts';

function listSettingSelectors(scope: Scope, level: Level): SelectorPaths[] {
    const selectors: SelectorPaths[] = [];
    const owners = scope.settings.tables.structure?.environment_readers ?? [];
    if (level === 'all' && owners.length > 0) selectors.push({ ...ENVIRONMENT_SELECTOR, ignores: owners });
    const importExtension = scope.settings.tables[ESLINT_SETTINGS_TABLE]?.import_extension;
    if (importExtension !== undefined)
        selectors.push(ALIAS_IMPORT_SELECTORS[importExtension === 'extensionless' ? 'never' : 'always']);
    return selectors;
}

/**
Resolve the syntax selectors of each project scope: the base selectors at level all, the selectors of its
configurations, and those of its settings. A later ESLint block replaces the options of a rule instead of merging them.
Each scope gets one list, and gspot/restricted-syntax matches the files of each selector itself.

@param scopes every project scope.
@param level the selected lint rule level.
*/
export function buildSelectorBlocks(scopes: Scope[], level: Level): SelectorBlock[] {
    const scopePaths = scopes.map((each) => each.path);
    return scopes.map((scope) => {
        const declarations = scope.configurations.flatMap((configuration) =>
            configuration.eslint.selectors.filter((selector) => level === 'all' || selector.level === 'basic'),
        );
        const applied = new Map(declarations.map((declaration) => [declaration.selector, declaration]))
            .values()
            .map(
                (declaration): SelectorPaths => ({
                    selector: declaration.selector,
                    message: declaration.message,
                    ...(declaration.paths_setting !== undefined && {
                        files: (scope.settings.valuesByKey[declaration.paths_setting] as string[] | undefined) ?? [],
                    }),
                }),
            )
            .filter(({ files }) => files === undefined || files.length > 0)
            .toArray();
        return {
            scope: scope.path,
            ignoredScopes: listNestedScopes(scopePaths, scope.path),
            selectors: [...(level === 'all' ? BASE_SELECTORS : []), ...applied, ...listSettingSelectors(scope, level)],
        };
    });
}
