// Reuses initialization selection to reconcile the saved setup with current repository evidence.
import { isDeepStrictEqual } from 'node:util';
import { proposedScopes } from '#cli/repository/scopes.ts';
import { selectForInit } from '#cli/lifecycle/selection.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import { npmToolNames } from '#cli/configurations/declarations.ts';
import type { Policy, Mutation, TomlTable } from '#cli/types/policy/settings.ts';
import { updateConfigurationOverrides } from '#cli/lifecycle/configuration-overrides.ts';
import type { InitSelection, ConfigurationMerge, ConfigurationReconciliation } from '#cli/types/lifecycle/selection.ts';

function mergeConfigurationChoices(manifests: Map<string, Manifest>, input: ConfigurationMerge): string[] {
    const { saved, found, overrides } = input;
    const preserved = saved.filter((id) => {
        const kind = manifests.get(id)?.configuration.kind;
        return kind !== 'language' && kind !== 'framework';
    });
    const wanted = new Set([
        ...found.filter((id) => !(overrides?.removed ?? []).includes(id)),
        ...(overrides?.added ?? []),
        ...preserved,
    ]);
    return [...saved.filter((id) => wanted.has(id)), ...wanted.values().filter((id) => !saved.includes(id))];
}

function reconcileChoices(session: Session, detected: InitSelection): ConfigurationReconciliation {
    const {
        root,
        manifests,
        policyFiles: { policy },
    } = session;
    const selections = updateConfigurationOverrides({
        choices: new Map([
            ['', policy.configurations],
            ...policy.scopes.map((scope): [string, string[]] => [scope.path, scope.configurations]),
        ]),
        manifests,
        previous: getOwnership(root).selections ?? {},
    });
    const rootIds = mergeConfigurationChoices(manifests, {
        saved: policy.configurations,
        found: detected.rootIds,
        overrides: selections[''],
    });
    const scopeIds = new Map(
        [...detected.scopeConfigurations].map(([path, found]) => [
            path,
            mergeConfigurationChoices(manifests, {
                saved: policy.scopes.find((scope) => scope.path === path)?.configurations ?? [],
                found,
                overrides: selections[path],
            }),
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
        selections: Object.fromEntries(
            new Map([
                ...policy.scopes.map((scope): [string, string[]] => [scope.path, scope.configurations]),
                ['', rootIds],
                ...scopeIds,
            ])
                .entries()
                .map(([path, ids]) => [
                    path,
                    {
                        configurations: ids.filter((id) =>
                            ['language', 'framework'].includes(manifests.get(id)?.configuration.kind ?? ''),
                        ),
                        added: selections[path]?.added ?? [],
                        removed: selections[path]?.removed ?? [],
                    },
                ]),
        ),
        mutate: configurationMutation(policy, rootIds, scopeIds),
    };
}

function configurationMutation(policy: Policy, rootIds: string[], scopeIds: Map<string, string[]>): Mutation {
    return (raw) => {
        if (!isDeepStrictEqual(policy.configurations, rootIds)) raw['configurations'] = rootIds;
        const scopes = (raw['scope'] as TomlTable[] | undefined) ?? [];
        for (const [path, configurations] of scopeIds) {
            const existing = scopes.find((scope) => scope['path'] === path);
            if (existing === undefined) scopes.push({ path, configurations });
            else if (!isDeepStrictEqual(existing['configurations'], configurations))
                existing['configurations'] = configurations;
        }
        if (scopes.length > 0) raw['scope'] = scopes;
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
        options: { cwd: root, yes: true, isDryRun: true, install: false },
    });
    return reconcileChoices(session, detected);
}
