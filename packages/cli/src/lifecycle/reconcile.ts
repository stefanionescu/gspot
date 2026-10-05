// Reuses initialization selection to reconcile the saved setup with current repository evidence.
import { isDeepStrictEqual } from 'node:util';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import type { ConfigurationReconciliation } from '#cli/types/lifecycle/selection.ts';

function mergeConfigurationChoices(manifests: Map<string, Manifest>, saved: string[], found: string[]): string[] {
    const preserved = saved.filter((id) => {
        const kind = manifests.get(id)?.configuration.kind;
        return kind !== 'language' && kind !== 'framework';
    });
    const wanted = new Set([...found, ...preserved]);
    return [...saved.filter((id) => wanted.has(id)), ...found.filter((id) => !saved.includes(id))];
}

/**
 * Calculate configuration changes without modifying policy or generated outputs.
 * @param session the saved policy and current repository inventory
 * @returns the policy mutation and descriptions of changed selections
 */
export function reconcileConfigurations(session: Session): ConfigurationReconciliation {
    const {
        root,
        repository: repo,
        manifests,
        policyFiles: { policy },
    } = session;
    const projectManifests = readManifests(root, repo.files);
    const discovered = proposedScopes(
        repo.files,
        projectManifests,
        [...manifests.values()].flatMap((manifest) => manifest.detect.project_files),
    );
    const workspace = new Map(
        [...discovered, ...repo.scopes.filter((scope) => scope.path !== '')].map((scope) => [scope.path, scope]),
    );
    const detected = selectForInit({
        root,
        repo,
        projectManifests,
        manifests,
        workspace: [...workspace.values()],
        options: { cwd: root, yes: true, isDryRun: true, install: false },
    });
    const rootIds = mergeConfigurationChoices(manifests, policy.configurations, detected.rootIds);
    const scopeIds = new Map(
        [...detected.scopeConfigurations].map(([path, found]) => [
            path,
            mergeConfigurationChoices(
                manifests,
                policy.scopes.find((scope) => scope.path === path)?.configurations ?? [],
                found,
            ),
        ]),
    );
    const notes: string[] = [];
    const describe = (path: string, saved: string[], wanted: string[]): void => {
        for (const id of wanted) if (!saved.includes(id)) notes.push(`added configuration ${id} in ${path}`);
        for (const id of saved) if (!wanted.includes(id)) notes.push(`removed configuration ${id} in ${path}`);
    };
    describe('root', policy.configurations, rootIds);
    for (const [path, ids] of scopeIds)
        describe(path, policy.scopes.find((scope) => scope.path === path)?.configurations ?? [], ids);
    return {
        notes,
        mutate: (raw) => {
            if (!isDeepStrictEqual(policy.configurations, rootIds)) raw['configurations'] = rootIds;
            const scopes = (raw['scope'] as TomlTable[] | undefined) ?? [];
            for (const [path, configurations] of scopeIds) {
                const existing = scopes.find((scope) => scope['path'] === path);
                if (existing === undefined) scopes.push({ path, configurations });
                else if (!isDeepStrictEqual(existing['configurations'], configurations))
                    existing['configurations'] = configurations;
            }
            if (scopes.length > 0) raw['scope'] = scopes;
        },
    };
}
