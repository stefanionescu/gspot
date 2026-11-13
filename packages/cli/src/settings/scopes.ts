import { NO_ROOT_SCOPE_MESSAGE } from '#cli/config/settings/validation.ts';
import { listAlwaysSelected, selectConfigurations } from '#cli/manifests/select.ts';
import { compareScopeDepth, isInScope, selectScopePath } from '#cli/repository/scopes.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { RemovedConfiguration, Scope, SelectedConfigurations, Settings } from '#cli/types/settings.ts';

export function findParentScope(scopes: Scope[], path: string): Scope | undefined {
    if (path === '') return undefined;
    const parent = selectScopePath(extractParentFolder(path), scopes);
    return scopes.find((scope) => scope.path === parent);
}

export function selectConfigurationsForScope(selected: SelectedConfigurations, scopePath: string): Configuration[] {
    const automatic = listAlwaysSelected();
    const choices = new Set<string>([...selected.configurations, ...automatic]);
    const tables = [
        selected,
        ...[...selected.scopes]
            .filter(([ancestor]) => isInScope(scopePath, ancestor))
            .toSorted(([left], [right]) => compareScopeDepth(left, right))
            .map(([, scopeTable]) => scopeTable),
    ];
    for (const table of tables) {
        for (const configuration of table.configurations) choices.add(configuration);
        for (const removed of table.removed_configurations) choices.delete(removed);
    }
    return selectConfigurations([...choices]);
}

export function listSelectedConfigurations(
    scopes: ReadonlyArray<{ configurations: Configuration[] }>,
): Configuration[] {
    const seen = new Map<string, Configuration>();
    for (const scope of scopes)
        for (const configuration of scope.configurations)
            if (!seen.has(configuration.name)) seen.set(configuration.name, configuration);
    return seen.values().toArray();
}

export function isConfigurationSelected(
    scopes: ReadonlyArray<{ configurations: Configuration[] }>,
    name: string,
): boolean {
    return scopes.some((scope) => scope.configurations.some((configuration) => configuration.name === name));
}

export function listRemovedConfigurations(settings: Settings): RemovedConfiguration[] {
    return [['', settings] as const, ...settings.scopes].flatMap(([scopePath, table]) => {
        const reasons = table.written['removed_configurations'] as Record<string, string>;
        return table.removed_configurations.map((name) => ({
            name,
            scope: scopePath,
            reason: reasons[name] as string,
        }));
    });
}

export function getRootScope(scopes: readonly Scope[]): Scope {
    const root = scopes.find((scope) => scope.path === '');
    if (root === undefined) throw new Error(NO_ROOT_SCOPE_MESSAGE);
    return root;
}
