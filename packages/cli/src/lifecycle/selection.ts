import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import type { ScopeEntry } from '#cli/types/repository/inventory.ts';
import { detectConfigurations } from '#cli/configurations/detect.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { NO_CONFIGURATIONS } from '#cli/config/lifecycle/selection.ts';
import { unknownConfigurations } from '#cli/configurations/problems.ts';
import type { Manifest, ConfigurationEvidence } from '#cli/types/configurations.ts';

import type {
    InitInputs,
    InitDetection,
    InitSelection,
    ConfigurationReason,
    ConfigurationChoices,
} from '#cli/types/lifecycle/selection.ts';

function parseScopeFlags(flags: string[] | undefined): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const list = flags ?? [];
    for (const flag of list) {
        const [path = '', ids = ''] = flag.split('=');
        const items = ids
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id !== '');
        map.set(path.endsWith('/') ? path.slice(0, -1) : path, items);
    }
    return map;
}

function initScopes(root: string, workspace: ScopeEntry[], scopeFlags: Map<string, string[]>): ScopeEntry[] {
    const scopes: ScopeEntry[] = [
        { name: 'root', path: '', configurations: [], source: 'root' },
        ...workspace.filter((scope) => scopeFlags.size === 0 || scopeFlags.has(scope.path)),
    ];
    using files = openRoot(root);
    for (const path of scopeFlags.keys()) {
        if (path === '') continue;
        if (files.stat(path)?.isDirectory() !== true)
            throw new GspotError('selection', [`Scope directory does not exist: ${path}`]);
        if (scopes.every((scope) => scope.path !== path))
            scopes.push({ name: path.split('/').pop() ?? path, path, configurations: [], source: 'flag' });
    }
    return scopes;
}

function getCandidate(context: InitDetection, configuration: string): Manifest | undefined {
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
    const named = context.options.configurations?.filter((id) => id !== NO_CONFIGURATIONS);
    if (named && context.options.template?.tables.selection !== 'detect') return named;
    const detectedConfigurations = detected
        .filter((evidence) => {
            const manifest = getCandidate(context, evidence.configuration);
            if (!manifest) return false;
            const { kind } = manifest.configuration;
            return !hasScopes || kind === 'general' || kind === 'language';
        })
        .map((evidence) => evidence.configuration);
    return [...new Set([...(named ?? []), ...detectedConfigurations])];
}

function scopeSelection(
    context: InitDetection,
    scope: ScopeEntry,
    flagged: string[] | undefined,
    rootIds: string[],
): string[] {
    const ids =
        flagged ??
        detectConfigurations(context.files, context.manifests, context.fields, scope.path)
            .filter((evidence) => {
                const manifest = getCandidate(context, evidence.configuration);
                return manifest !== undefined && manifest.configuration.kind !== 'general';
            })
            .map((evidence) => evidence.configuration);
    // A language stays out of a scope only while the root really keeps it: some source of it lies outside every scope.
    const atRoot = new Set(rootIds);
    return ids.filter((id) => !atRoot.has(id) || context.manifests.get(id)?.configuration.kind !== 'language');
}

function hasSourceOutsideScopes(context: InitDetection, manifest: Manifest, scopes: ScopeEntry[]): boolean {
    return context.files.some(
        (file) =>
            file.kind === 'source' &&
            scopes.every((scope) => scope.path === '' || !isInScope(file.path, scope.path)) &&
            manifest.files.extensions.some((extension) => file.path.endsWith(extension)),
    );
}

function assertKnown(
    options: InitInputs['options'],
    scopeFlags: Map<string, string[]>,
    manifests: Map<string, Manifest>,
): void {
    const configurations = (options.configurations ?? []).filter((id) => id !== NO_CONFIGURATIONS);
    const declarations = [...configurations, ...scopeFlags.values().toArray().flat()].map((name) => ({ name }));
    const unknown = unknownConfigurations(declarations, manifests).map(({ message: diagnostic }) => diagnostic);
    if (unknown.length > 0) throw new GspotError('selection', unknown);
}

// Exact selections retain their list. Other selections gain one level of detected recommendations.
function listedConfigurations(
    options: InitInputs['options'],
    ids: string[],
    manifests: Map<string, Manifest>,
    detected: Set<string>,
): string[] {
    if (options.template?.tables.selection === 'exact' || options.isListExact === true) return ids;
    const recommended = ids.flatMap((id) => manifests.get(id)?.configuration.recommends ?? []);
    return [
        ...new Set([
            ...ids,
            ...recommended.filter((id) => {
                const manifest = manifests.get(id);
                // A recommendation without detection criteria does not require a source match.
                const hasDetection =
                    manifest !== undefined && Object.values(manifest.detect).some((list) => list.length > 0);
                return !hasDetection || detected.has(id);
            }),
        ]),
    ];
}

function reasonFor(id: string, sets: ConfigurationChoices): ConfigurationReason {
    if (sets.named.has(id)) return 'named';
    if (sets.chosen.has(id)) return 'detected';
    return sets.listed.has(id) ? 'recommended' : 'required';
}

/**
 * Selects the configurations for init from detection, the --configurations and --scope flags, and the workspace scopes.
 * @param inputs the root, the tracked files, the manifests read from the repository, the workspace scopes, every configuration manifest, and the init flags.
 * @returns the scopes, the root and per-scope configuration ids, and the closure of everything selected.
 */
export function selectForInit(inputs: InitInputs): InitSelection {
    const { root, repo, fields, workspace, manifests, options } = inputs;
    const context: InitDetection = { manifests, files: repo.files, fields, options, hasGit: repo.hasGit };
    const scopeFlags = parseScopeFlags(options.scopes);
    assertKnown(options, scopeFlags, manifests);
    const scopes = initScopes(root, workspace, scopeFlags);
    const hasScopes = scopes.length > 1;
    const detected = detectConfigurations(repo.files, manifests, fields);
    const proposedRoot = rootSelection(context, detected, hasScopes);
    const scopeConfigurations = new Map<string, string[]>();
    const heldAtRoot = proposedRoot.filter((id) => {
        const manifest = manifests.get(id);
        return (
            manifest?.configuration.kind !== 'language' ||
            !hasScopes ||
            hasSourceOutsideScopes(context, manifest, scopes)
        );
    });
    for (const scope of scopes)
        if (scope.path !== '')
            scopeConfigurations.set(scope.path, scopeSelection(context, scope, scopeFlags.get(scope.path), heldAtRoot));
    const inScopes = new Set(scopeConfigurations.values().toArray().flat());
    const rootIds = listedConfigurations(
        options,
        [...proposedRoot, ...inScopes],
        manifests,
        new Set(detected.map((evidence) => evidence.configuration)),
    ).filter((id) => !inScopes.has(id));
    const selectedIds = new Set(
        selectConfigurations([...rootIds, ...inScopes], manifests).map((manifest) => manifest.configuration.name),
    );
    const sets = {
        named: new Set(options.configurations ?? scopeFlags.values().toArray().flat()),
        chosen: new Set([...proposedRoot, ...inScopes]),
        listed: new Set([...rootIds, ...inScopes]),
    };
    const how = new Map([...selectedIds].map((id) => [id, reasonFor(id, sets)]));
    return { scopes, rootIds, scopeConfigurations, selectedIds, detected, how };
}
