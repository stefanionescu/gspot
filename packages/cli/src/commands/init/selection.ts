import { isInScope } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { Scope } from '#cli/types/repository/inventory.ts';
import { hasDetectionRules, detectConfigurations } from '#cli/repository/detect.ts';
import { selectConfigurations, assertKnownConfigurations } from '#cli/configurations/select.ts';
import { type ConfigurationEvidence, type ConfigurationSelection } from '#cli/types/repository/selection.ts';

import {
    type InitInputs,
    type SettingsDraft,
    type InitSelection,
    type ConfigurationReason,
    type ConfigurationChoices,
} from '#cli/types/commands/init.ts';

function findCandidate(context: InitInputs, configuration: string): Manifest | undefined {
    const manifest = context.manifests.get(configuration);
    if (!manifest) return undefined;
    if (manifest.configuration.when?.git === true && !context.repository.hasGit) return undefined;
    return manifest;
}

function selectRootConfigurations(
    context: InitInputs,
    detected: Pick<ConfigurationEvidence, 'configuration'>[],
): string[] {
    const hasScopes = context.repository.scopes.length > 1;
    const named = context.options.configurations;
    const detectedConfigurations = detected
        .filter((evidence) => {
            const manifest = findCandidate(context, evidence.configuration);
            if (!manifest) return false;
            const { group } = manifest.configuration;
            return !hasScopes || group === 'general' || group === 'language';
        })
        .map((evidence) => evidence.configuration);
    return [...new Set(named ?? detectedConfigurations)];
}

function selectScopeConfigurations(context: InitInputs, scope: Scope, rootIds: string[]): string[] {
    const ids = detectConfigurations(context.repository, context.manifests, scope.path)
        .filter((evidence) => {
            const manifest = findCandidate(context, evidence.configuration);
            return manifest !== undefined && manifest.configuration.group !== 'general';
        })
        .map((evidence) => evidence.configuration);
    // A language stays out of a scope only while the root keeps it: some source of the language sits outside every scope.
    const atRoot = new Set(rootIds);
    return ids.filter((id) => !atRoot.has(id) || context.manifests.get(id)?.configuration.group !== 'language');
}

function hasSourceOutsideScopes(context: InitInputs, manifest: Manifest, scopes: Scope[]): boolean {
    return context.repository.files.some(
        (file) =>
            file.kind === 'source' &&
            scopes.every((scope) => scope.path === '' || !isInScope(file.path, scope.path)) &&
            manifest.files.extensions.some((extension) => file.path.endsWith(extension)),
    );
}

function expandSuggestions(ids: string[], manifests: Map<string, Manifest>, detected: Set<string>): string[] {
    const suggestions = ids.flatMap((id) => manifests.get(id)?.configuration.suggests ?? []);
    return [
        ...new Set([
            ...ids,
            ...suggestions.filter((id) => {
                const manifest = manifests.get(id);
                // A suggestion without detection rules needs no source match.
                const hasDetection = manifest !== undefined && hasDetectionRules(manifest);
                return !hasDetection || detected.has(id);
            }),
        ]),
    ];
}

function getSelectionReason(id: string, sets: ConfigurationChoices): ConfigurationReason {
    if (sets.named.has(id)) return 'named';
    if (sets.chosen.has(id)) return 'detected';
    return sets.listed.has(id) ? 'suggested' : 'required';
}

/**
 * Select configurations for init from the files, the named configurations, and the project scopes.
 *
 * @param inputs what init detected, with the flags.
 * @returns the scopes and the configurations of each.
 */
export function selectForInit(inputs: InitInputs): InitSelection {
    const { repository, manifests, options } = inputs;
    assertKnownConfigurations(options.configurations ?? [], manifests);
    const scopes = repository.scopes;
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(repository, manifests);
    const proposedRoot = selectRootConfigurations(inputs, detected);
    const scopeConfigurations = new Map<string, string[]>();
    const heldAtRoot = proposedRoot.filter((id) => {
        const manifest = manifests.get(id);
        return (
            manifest?.configuration.group !== 'language' ||
            !hasScopes ||
            hasSourceOutsideScopes(inputs, manifest, scopes)
        );
    });
    for (const scope of scopes)
        if (scope.path !== '')
            scopeConfigurations.set(scope.path, selectScopeConfigurations(inputs, scope, heldAtRoot));
    const inScopes = new Set(scopeConfigurations.values().toArray().flat());
    const named = new Set(options.configurations);
    const automatic = new Set(
        [...manifests.values()]
            .filter((manifest) => manifest.configuration.group === 'general' && manifest.configuration.always_selected)
            .map((manifest) => manifest.configuration.name),
    );
    const rootIds = expandSuggestions(
        [...proposedRoot, ...inScopes],
        manifests,
        new Set(detected.map((evidence) => evidence.configuration)),
    ).filter((id) => !inScopes.has(id) && (!automatic.has(id) || named.has(id)));
    const selectedIds = new Set(
        selectConfigurations([...rootIds, ...proposedRoot, ...inScopes], manifests).map(
            (manifest) => manifest.configuration.name,
        ),
    );
    const sets = {
        named,
        chosen: new Set([...proposedRoot, ...inScopes]),
        listed: new Set([...rootIds, ...inScopes]),
    };
    const how = new Map([...selectedIds].map((id) => [id, getSelectionReason(id, sets)]));
    return { scopes, rootIds, scopeConfigurations, selectedIds, detected, how };
}

/**
 * Read the configuration choices from the draft.
 *
 * @param draft the choices.
 * @returns the configuration choices for the root and each scope.
 */
export function buildDraftSelection(draft: SettingsDraft): ConfigurationSelection {
    return {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
}
