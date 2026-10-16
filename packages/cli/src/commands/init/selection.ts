import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import type { ScopeEntry } from '#cli/types/repository/inventory.ts';
import { unknownConfigurations } from '#cli/configurations/unknown-names.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/selection.ts';

import type {
    InitInputs,
    InitDetection,
    InitSelection,
    ConfigurationReason,
    ConfigurationChoices,
} from '#cli/types/commands/init.ts';

function findCandidate(context: InitDetection, configuration: string): Manifest | undefined {
    const manifest = context.manifests.get(configuration);
    if (!manifest) return undefined;
    if (manifest.configuration.when?.git === true && !context.hasGit) return undefined;
    return manifest;
}

function rootSelection(
    context: InitDetection,
    detected: Pick<ConfigurationEvidence, 'configuration'>[],
    hasScopes: boolean,
): string[] {
    const named = context.options.configurations;
    const detectedConfigurations = detected
        .filter((evidence) => {
            const manifest = findCandidate(context, evidence.configuration);
            if (!manifest) return false;
            const { group } = manifest.configuration;
            return !hasScopes || group === 'general' || group === 'language';
        })
        .map((evidence) => evidence.configuration);
    const template = context.options.template;
    if (template !== undefined)
        return [...new Set([...detectedConfigurations, ...(named ?? []), ...(template.tables.configurations ?? [])])];
    return [...new Set(named ?? detectedConfigurations)];
}

function scopeSelection(context: InitDetection, scope: ScopeEntry, rootIds: string[]): string[] {
    const ids = detectConfigurations(
        context.root,
        context.files,
        context.manifests,
        context.packageManifests,
        scope.path,
    )
        .filter((evidence) => {
            const manifest = findCandidate(context, evidence.configuration);
            return manifest !== undefined && manifest.configuration.group !== 'general';
        })
        .map((evidence) => evidence.configuration);
    // A language stays out of a scope only while the root really keeps it: some source of it lies outside every scope.
    const atRoot = new Set(rootIds);
    return ids.filter((id) => !atRoot.has(id) || context.manifests.get(id)?.configuration.group !== 'language');
}

function hasSourceOutsideScopes(context: InitDetection, manifest: Manifest, scopes: ScopeEntry[]): boolean {
    return context.files.some(
        (file) =>
            file.kind === 'source' &&
            scopes.every((scope) => scope.path === '' || !isInScope(file.path, scope.path)) &&
            manifest.files.extensions.some((extension) => file.path.endsWith(extension)),
    );
}

function assertKnown(options: InitInputs['options'], manifests: Map<string, Manifest>): void {
    const configurations = options.configurations ?? [];
    const declarations = configurations.map((name) => ({ name }));
    const unknown = unknownConfigurations(declarations, manifests).map(({ message: diagnostic }) => diagnostic);
    if (unknown.length > 0) throw new GspotError('arguments', unknown.join('\n'));
}

function listedConfigurations(ids: string[], manifests: Map<string, Manifest>, detected: Set<string>): string[] {
    const suggestions = ids.flatMap((id) => manifests.get(id)?.configuration.suggests ?? []);
    return [
        ...new Set([
            ...ids,
            ...suggestions.filter((id) => {
                const manifest = manifests.get(id);
                // A suggestion without detection criteria does not require a source match.
                const hasDetection =
                    manifest !== undefined &&
                    Object.values(manifest.detect).some((entry) => Object.keys(entry).length > 0);
                return !hasDetection || detected.has(id);
            }),
        ]),
    ];
}

function reasonFor(id: string, sets: ConfigurationChoices): ConfigurationReason {
    if (sets.named.has(id)) return 'named';
    if (sets.chosen.has(id)) return 'detected';
    return sets.listed.has(id) ? 'suggested' : 'required';
}

/**
 * Selects configurations for init from the files, named configurations, and project scopes.
 * @param inputs the root, the tracked files, the manifests read from the repository, the project scopes, every configuration manifest, and the init flags.
 * @returns the scopes, the root and per-scope configuration ids, and the closure of everything selected.
 */
export function selectForInit(inputs: InitInputs): InitSelection {
    const { root, repo, packageManifests, manifests, options } = inputs;
    const context: InitDetection = {
        root,
        manifests,
        files: repo.files,
        packageManifests,
        options,
        hasGit: repo.hasGit,
    };
    assertKnown(options, manifests);
    const scopes = inputs.scopes;
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(root, repo.files, manifests, packageManifests);
    const proposedRoot = rootSelection(context, detected, hasScopes);
    const scopeConfigurations = new Map<string, string[]>();
    const heldAtRoot = proposedRoot.filter((id) => {
        const manifest = manifests.get(id);
        return (
            manifest?.configuration.group !== 'language' ||
            !hasScopes ||
            hasSourceOutsideScopes(context, manifest, scopes)
        );
    });
    for (const scope of scopes)
        if (scope.path !== '') scopeConfigurations.set(scope.path, scopeSelection(context, scope, heldAtRoot));
    const inScopes = new Set(scopeConfigurations.values().toArray().flat());
    const named = new Set([...(options.configurations ?? []), ...(options.template?.tables.configurations ?? [])]);
    const automatic = new Set(
        [...manifests.values()]
            .filter((manifest) => manifest.configuration.group === 'general' && manifest.configuration.always_selected)
            .map((manifest) => manifest.configuration.name),
    );
    const rootIds = listedConfigurations(
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
    const how = new Map([...selectedIds].map((id) => [id, reasonFor(id, sets)]));
    return { scopes, rootIds, scopeConfigurations, selectedIds, detected, how };
}
