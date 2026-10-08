// Reuses initialization selection to reconcile the saved setup with current repository evidence.
import { isDeepStrictEqual } from 'node:util';
import { isRecord } from '#cli/platform/objects.ts';
import type { Session } from '#cli/types/planning.ts';
import { npmToolNames } from '#cli/configurations/pins.ts';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { Policy, Mutation } from '#cli/types/policy/settings.ts';
import type { InitSelection, ConfigurationMerge, ConfigurationReconciliation } from '#cli/types/lifecycle/selection.ts';

function mergeConfigurationChoices({ saved, found, removed }: ConfigurationMerge): string[] {
    return [...new Set([...saved, ...found.filter((id) => !removed.includes(id))])];
}

function reconcileChoices(session: Session, detected: InitSelection): ConfigurationReconciliation {
    const { policy } = session.policyFiles;
    const rootIds = mergeConfigurationChoices({
        saved: policy.configurations,
        found: detected.rootIds,
        removed: policy.removed_configurations,
    });
    const scopeIds = new Map(
        [...detected.scopeConfigurations].map(([path, found]) => [
            path,
            mergeConfigurationChoices({
                saved: policy.scope[path]?.configurations ?? [],
                found,
                removed: policy.scope[path]?.removed_configurations ?? [],
            }),
        ]),
    );
    const notes: string[] = [];
    const describe = (path: string, saved: string[], wanted: string[]): void => {
        for (const id of wanted) if (!saved.includes(id)) notes.push(`added configuration ${id} in ${path}`);
        for (const id of saved) if (!wanted.includes(id)) notes.push(`removed configuration ${id} in ${path}`);
    };
    describe('root', policy.configurations, rootIds);
    for (const [path, ids] of scopeIds) describe(path, policy.scope[path]?.configurations ?? [], ids);
    return {
        notes,
        mutate: configurationMutation(policy, rootIds, scopeIds),
    };
}

function configurationMutation(policy: Policy, rootIds: string[], scopeIds: Map<string, string[]>): Mutation {
    return (raw) => {
        if (!isDeepStrictEqual(policy.configurations, rootIds)) raw['configurations'] = rootIds;
        const scopes = isRecord(raw['scope']) ? raw['scope'] : {};
        for (const [path, configurations] of scopeIds) {
            const existing = scopes[path];
            if (!isRecord(existing)) scopes[path] = { configurations };
            else if (!isDeepStrictEqual(existing['configurations'], configurations))
                existing['configurations'] = configurations;
        }
        if (Object.keys(scopes).length > 0) raw['scope'] = scopes;
    };
}

/**
 * Calculate configuration changes without modifying policy or generated outputs.
 * @param session the saved policy and current repository inventory
 * @returns the policy mutation and descriptions of changed selections
 */
export function reconcileConfigurations(session: Session): ConfigurationReconciliation {
    const { root, repository: repo, manifests } = session;
    const projectManifests = readManifests(root, repo.files);
    const discovered = proposedScopes(
        repo.files,
        projectManifests,
        [...manifests.values()].flatMap((manifest) => manifest.detect.project_files),
        npmToolNames(manifests.values()),
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
        options: {},
    });
    return reconcileChoices(session, detected);
}
