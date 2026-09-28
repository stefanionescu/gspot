import { nearMatches } from '#cli/policy/near.ts';
import type { Manifest } from '#cli/types/kits.ts';
import * as messages from '#cli/policy/messages.ts';
import { detectConfigurations } from '#cli/kits/detect.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { NO_CONFIGURATIONS } from '#cli/config/commands/init.ts';
import type { ScopeEntry } from '#cli/types/repository/repository.ts';
import { requireChain, SelectionError, selectConfigurations } from '#cli/kits/select.ts';
import type { InitInputs, InitContext, InitSelection, ConfigurationReason } from '#cli/types/commands/init.ts';

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
    const files = openConfinedRoot(root);
    try {
        for (const path of new Set([...scopes.map((scope) => scope.path), ...scopeFlags.keys()])) {
            if (path === '') continue;
            if (files.stat(path)?.isDirectory() !== true)
                throw new SelectionError([`Scope directory does not exist: ${path}`]);
            if (scopes.every((scope) => scope.path !== path))
                scopes.push({ name: path.split('/').pop() ?? path, path, configurations: [], source: 'gspot.toml' });
        }
    } finally {
        files.close();
    }
    return scopes;
}

function getCandidate(context: InitContext, configuration: string, without: Set<string>): Manifest | undefined {
    const manifest = context.manifests.get(configuration);
    if (!manifest || without.has(configuration)) return undefined;
    if (manifest.configuration.needs_git && !context.hasGit) return undefined;
    if (manifest.configuration.proposed && !context.options.yes) return undefined;
    return manifest;
}

function rootSelection(context: InitContext, rootProposals: { configuration: string }[], hasScopes: boolean): string[] {
    const without = new Set(context.options.without);
    const named = context.options.configurations?.filter((id) => id !== NO_CONFIGURATIONS && !without.has(id));
    if (named && context.options.profile?.tables.selection !== 'detect') return named;
    const detected = rootProposals
        .filter((proposal) => {
            const manifest = getCandidate(context, proposal.configuration, without);
            if (!manifest) return false;
            const { kind } = manifest.configuration;
            return !hasScopes || kind === 'policy' || kind === 'language';
        })
        .map((proposal) => proposal.configuration);
    return [...new Set([...(named ?? []), ...detected])];
}

function scopeSelection(
    context: InitContext,
    scope: ScopeEntry,
    flagged: string[] | undefined,
    rootIds: string[],
): string[] {
    const without = new Set(context.options.without);
    const ids =
        flagged ??
        detectConfigurations(context.files, context.manifests, context.facts, scope.path)
            .filter((proposal) => {
                const manifest = getCandidate(context, proposal.configuration, without);
                return manifest !== undefined && manifest.configuration.kind !== 'policy';
            })
            .map((proposal) => proposal.configuration);
    // A language stays out of a scope only while the root really keeps it: some source of it lies outside every scope.
    const atRoot = new Set(rootIds);
    return ids.filter((id) => !atRoot.has(id) || context.manifests.get(id)?.configuration.kind !== 'language');
}

function hasSourceOutsideScopes(context: InitContext, manifest: Manifest, scopes: ScopeEntry[]): boolean {
    return context.files.some(
        (file) =>
            file.nature === 'source' &&
            scopes.every((scope) => scope.path === '' || !file.path.startsWith(`${scope.path}/`)) &&
            manifest.claims.extensions.some((extension) => file.path.endsWith(extension)),
    );
}

function rootLanguagesKept(
    context: InitContext,
    rootIds: string[],
    scopes: ScopeEntry[],
    inScopes: Set<string>,
): string[] {
    return rootIds.filter((id) => {
        const manifest = context.manifests.get(id);
        if (manifest?.configuration.kind !== 'language' || !inScopes.has(id)) return true;
        return hasSourceOutsideScopes(context, manifest, scopes);
    });
}

function assertKnown(
    options: InitInputs['options'],
    scopeFlags: Map<string, string[]>,
    manifests: Map<string, Manifest>,
): void {
    const configurations = (options.configurations ?? []).filter((id) => id !== NO_CONFIGURATIONS);
    const without = options.without ?? [];
    const known = manifests.keys().toArray();
    const unknown = [...configurations, ...without, ...scopeFlags.values().toArray().flat()]
        .filter((id) => !manifests.has(id))
        .map((id) => messages.unknownConfiguration(id, nearMatches(id, known)));
    if (unknown.length > 0) throw new SelectionError(unknown);
}

function assertNoneRequired(options: InitInputs['options'], named: string[], manifests: Map<string, Manifest>): void {
    const left = (options.without ?? []).flatMap((id) => {
        const chain = named
            .filter((start) => start !== id)
            .map((start) => requireChain(id, start, manifests))
            .find((found) => found !== undefined);
        return chain ? [messages.withoutRequired(id, chain)] : [];
    });
    if (left.length > 0) throw new SelectionError(left);
}

// Exact selections retain their list. Other selections gain one level of detected recommendations.
function listedConfigurations(
    options: InitInputs['options'],
    ids: string[],
    manifests: Map<string, Manifest>,
    detected: Set<string>,
): string[] {
    if (options.profile?.tables.selection === 'exact' || options.isListExact === true) return ids;
    const without = new Set(options.without);
    const recommended = ids.flatMap((id) => manifests.get(id)?.configuration.recommends ?? []);
    return [
        ...new Set([
            ...ids,
            ...recommended.filter((id) => {
                if (without.has(id)) return false;
                const manifest = manifests.get(id);
                // A recommendation without detection criteria does not require a source match.
                const hasDetection =
                    manifest !== undefined && Object.values(manifest.detect).some((list) => list.length > 0);
                return !hasDetection || detected.has(id);
            }),
        ]),
    ];
}

function reasonFor(
    id: string,
    sets: { named: Set<string>; chosen: Set<string>; listed: Set<string> },
): ConfigurationReason {
    if (sets.named.has(id)) return 'named';
    if (sets.chosen.has(id)) return 'detected';
    return sets.listed.has(id) ? 'recommended' : 'required';
}

function closure(ids: Iterable<string>, manifests: Map<string, Manifest>): Set<string> {
    const selected = new Set<string>();
    for (const id of ids) {
        const required = selectConfigurations([id], manifests);
        for (const manifest of required) selected.add(manifest.configuration.name);
    }
    return selected;
}

/**
 * Selects the configurations for init from detection, the --configurations, --without and --scopes flags, and the workspace scopes.
 * @param inputs the root, the tracked files, the manifests read from the repository, the workspace scopes, every configuration manifest, and the init flags.
 * @returns the scopes, the root and per-scope configuration ids, and the closure of everything selected.
 */
export function selectForInit(inputs: InitInputs): InitSelection {
    const { root, repo, facts, workspace, manifests, options } = inputs;
    const context: InitContext = { manifests, files: repo.files, facts, options, hasGit: repo.hasGit };
    const scopeFlags = parseScopeFlags(options.scopes);
    assertKnown(options, scopeFlags, manifests);
    const scopes = initScopes(root, workspace, scopeFlags);
    const hasScopes = scopes.length > 1;
    const rootProposals = detectConfigurations(repo.files, manifests, facts);
    const proposedRoot = rootSelection(context, rootProposals, hasScopes);
    const scopeProposals = new Map<string, string[]>();
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
            scopeProposals.set(scope.path, scopeSelection(context, scope, scopeFlags.get(scope.path), heldAtRoot));
    const inScopes = new Set(scopeProposals.values().toArray().flat());
    const keptRoot = hasScopes ? rootLanguagesKept(context, proposedRoot, scopes, inScopes) : proposedRoot;
    const rootIds = listedConfigurations(
        options,
        [...keptRoot, ...inScopes],
        manifests,
        new Set(rootProposals.map((proposal) => proposal.configuration)),
    ).filter((id) => !inScopes.has(id));
    assertNoneRequired(options, [...rootIds, ...inScopes], manifests);
    const selectedIds = closure([...rootIds, ...inScopes], manifests);
    const sets = {
        named: new Set(options.configurations ?? scopeFlags.values().toArray().flat()),
        chosen: new Set([...keptRoot, ...inScopes]),
        listed: new Set([...rootIds, ...inScopes]),
    };
    const how = new Map([...selectedIds].map((id) => [id, reasonFor(id, sets)]));
    return { scopes, rootIds, scopeProposals, selectedIds, rootProposals, how };
}
