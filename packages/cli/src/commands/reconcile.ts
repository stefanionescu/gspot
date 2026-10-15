// Uses the files in the repository to update its saved configuration choices.
import { isRecord } from '#cli/objects.ts';
import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/types/planning.ts';
import { byScopeDepth } from '#cli/repository/scopes.ts';
import { selectForScope } from '#cli/repository/select.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { selectForInit } from '#cli/commands/init/selection.ts';
import type { InitSelection } from '#cli/types/commands/init.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import type { Mutation, TomlTable } from '#cli/types/settings/file.ts';
import type { ConfigurationLists, ConfigurationReconciliation } from '#cli/types/repository/selection.ts';

function mergeConfigurationChoices({ saved, found, removed }: ConfigurationLists): string[] {
    return [...new Set([...saved, ...found.filter((id) => !removed.includes(id))])];
}

function reconcileChoices(session: Session, detected: InitSelection): ConfigurationReconciliation {
    const { settings } = session.settingsFile;
    const selected = new Set([
        ...session.scopes
            .filter(({ scope }) => scope.path === '')
            .flatMap(({ selected }) => selected.map((manifest) => manifest.configuration.name)),
        ...selectConfigurations(detected.rootIds, session.manifests).flatMap(
            (manifest) => manifest.configuration.requires,
        ),
    ]);
    const rootIds = mergeConfigurationChoices({
        saved: settings.configurations,
        found: detected.rootIds.filter((id) => !selected.has(id)),
        removed: settings.removed_configurations,
    });
    const selections = { ...settings, configurations: rootIds, scope: { ...settings.scope } };
    const scopeIds = new Map(
        [...detected.scopeConfigurations]
            .toSorted(([left], [right]) => byScopeDepth(left, right))
            .map(([path, found]) => {
                const inherited = new Set(
                    selectForScope(selections, path, session.manifests).map((manifest) => manifest.configuration.name),
                );
                const removed = settings.scope[path]?.removed_configurations ?? [];
                const configurations = mergeConfigurationChoices({
                    saved: settings.scope[path]?.configurations ?? [],
                    found: found.filter((id) => !inherited.has(id)),
                    removed,
                });
                selections.scope[path] = { configurations, removed_configurations: removed };
                return [path, configurations] as const;
            }),
    );
    const notes: string[] = [];
    const describe = (path: string, saved: string[], wanted: string[]): void => {
        for (const id of wanted) if (!saved.includes(id)) notes.push(`added configuration ${id} in ${path}`);
        for (const id of saved) if (!wanted.includes(id)) notes.push(`removed configuration ${id} in ${path}`);
    };
    describe('root', settings.configurations, rootIds);
    for (const [path, ids] of scopeIds) describe(path, settings.scope[path]?.configurations ?? [], ids);
    return {
        notes,
        mutate: configurationMutation(settings, rootIds, scopeIds),
    };
}

function configurationMutation(settings: Settings, rootIds: string[], scopeIds: Map<string, string[]>): Mutation {
    return (written) => {
        if (!isDeepStrictEqual(settings.configurations, rootIds)) written['configurations'] = rootIds;
        const scopes = Array.isArray(written['scope']) ? written['scope'].filter(isRecord) : [];
        const missing = [...scopeIds].filter(
            ([path, configurations]) => configurations.length > 0 && !scopes.some((entry) => entry['path'] === path),
        );
        scopes.push(...missing.map(([path]) => ({ path })));
        const selections = [...scopeIds]
            .map(([path, configurations]) => ({
                existing: scopes.find((entry) => entry['path'] === path),
                configurations,
                removed: settings.scope[path]?.removed_configurations ?? [],
            }))
            .filter((entry): entry is typeof entry & { existing: TomlTable } => entry.existing !== undefined);
        const entries = selections.flatMap(({ existing, configurations, removed }) =>
            Object.entries({ configurations, removed_configurations: removed }).map(([key, values]) => ({
                existing,
                key,
                values,
            })),
        );
        for (const { existing, key, values } of entries) {
            if (values.length === 0) Reflect.deleteProperty(existing, key);
            else existing[key] = values;
        }
        if (scopes.length > 0) written['scope'] = scopes;
        else delete written['scope'];
    };
}

/**
 * Calculate configuration changes without modifying settings or generated files.
 * @param session the saved settings and current repository inventory
 * @returns the settings mutation and descriptions of changed selections
 */
export function reconcileConfigurations(session: Session): ConfigurationReconciliation {
    const { root, repository: repo, manifests, packageManifests } = session;
    const detected = selectForInit({
        root,
        repo,
        packageManifests,
        manifests,
        scopes: repo.scopes,
        options: {},
    });
    return reconcileChoices(session, detected);
}
