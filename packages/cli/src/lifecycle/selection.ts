// What init selects: presets at the root and per scope from detection and flags, then the closure of requires.
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { nearMatches } from '#cli/policy/near.ts';
import type { Manifest } from '#cli/presets/types.ts';
import * as messages from '#cli/policy/messages.ts';
import { detectPresets } from '#cli/presets/detect.ts';
import type { ScopeEntry, TrackedFile } from '#cli/repository/types.ts';
import { requireChain, SelectionError, selectPresets } from '#cli/presets/select.ts';
import type { InitContext, InitInputs, InitSelection, PresetReason } from '#cli/lifecycle/types.ts';

const NO_PRESETS = 'none';

function parseScopeFlags(flags: string[] | undefined): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const list = flags ?? [];
    for (const flag of list) {
        const [path = '', ids = ''] = flag.split('=', 2);
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
        { name: 'root', path: '', presets: [], source: 'root' },
        ...workspace.filter((scope) => scopeFlags.size === 0 || scopeFlags.has(scope.path)),
    ];
    const files = openConfinedRoot(root);
    try {
        for (const path of new Set([...scopes.map((scope) => scope.path), ...scopeFlags.keys()])) {
            if (path === '') continue;
            if (!files.stat(path)?.isDirectory()) throw new SelectionError([`Scope directory does not exist: ${path}`]);
            if (scopes.every((scope) => scope.path !== path))
                scopes.push({ name: path.split('/').pop() ?? path, path, presets: [], source: 'gspot.toml' });
        }
    } finally {
        files.close();
    }
    return scopes;
}

function isRootCandidate(context: InitContext, preset: string, hasScopes: boolean, without: Set<string>): boolean {
    const manifest = context.manifests.get(preset);
    if (!manifest || without.has(preset)) return false;
    const { kind, proposed } = manifest.preset;
    if (hasScopes && kind !== 'policy' && kind !== 'language') return false;
    return !proposed || context.options.yes;
}

function rootSelection(context: InitContext, rootProposals: { preset: string }[], hasScopes: boolean): string[] {
    const without = new Set(context.options.without);
    const named = context.options.presets?.filter((id) => id !== NO_PRESETS && !without.has(id));
    if (named && context.options.profile?.tables.selection !== 'detect') return named;
    const detected = rootProposals
        .filter((proposal) => isRootCandidate(context, proposal.preset, hasScopes, without))
        .map((proposal) => proposal.preset);
    return [...new Set([...(named ?? []), ...detected])];
}

function isScopeCandidate(context: InitContext, preset: string, without: Set<string>): boolean {
    const manifest = context.manifests.get(preset);
    if (!manifest || without.has(preset)) return false;
    return manifest.preset.kind !== 'policy' && (!manifest.preset.proposed || context.options.yes);
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
        detectPresets(context.files, context.manifests, context.facts, scope.path)
            .filter((proposal) => isScopeCandidate(context, proposal.preset, without))
            .map((proposal) => proposal.preset);
    // A language stays out of a scope only while the root really keeps it: some source of it lies outside every scope.
    const atRoot = new Set(rootIds);
    return ids.filter((id) => !atRoot.has(id) || context.manifests.get(id)?.preset.kind !== 'language');
}

function isOutsideEveryScope(file: TrackedFile, scopes: ScopeEntry[]): boolean {
    return scopes.every((scope) => scope.path === '' || !file.path.startsWith(`${scope.path}/`));
}

function hasSourceOutsideScopes(context: InitContext, manifest: Manifest, scopes: ScopeEntry[]): boolean {
    return context.files.some(
        (file) =>
            file.nature === 'source' &&
            isOutsideEveryScope(file, scopes) &&
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
        if (manifest?.preset.kind !== 'language' || !inScopes.has(id)) return true;
        return hasSourceOutsideScopes(context, manifest, scopes);
    });
}

function unknownProblems(ids: string[], manifests: Map<string, Manifest>): string[] {
    const known = manifests.keys().toArray();
    return ids.filter((id) => !manifests.has(id)).map((id) => messages.unknownPreset(id, nearMatches(id, known)));
}

function withoutProblems(without: string[], named: string[], manifests: Map<string, Manifest>): string[] {
    return without.flatMap((id) => {
        const chain = named
            .filter((start) => start !== id)
            .map((start) => requireChain(id, start, manifests))
            .find((found) => found !== undefined);
        return chain ? [messages.withoutRequired(id, chain)] : [];
    });
}

function assertKnown(
    options: InitInputs['options'],
    scopeFlags: Map<string, string[]>,
    manifests: Map<string, Manifest>,
): void {
    const presets = (options.presets ?? []).filter((id) => id !== NO_PRESETS);
    const without = options.without ?? [];
    const unknown = unknownProblems([...presets, ...without, ...scopeFlags.values().toArray().flat()], manifests);
    if (unknown.length > 0) throw new SelectionError(unknown);
}

function assertNoneRequired(options: InitInputs['options'], named: string[], manifests: Map<string, Manifest>): void {
    const left = withoutProblems(options.without ?? [], named, manifests);
    if (left.length > 0) throw new SelectionError(left);
}

// The presets a selection recommends, minus the ones the person left out; a recommendation recommends nothing further.
function recommendedAdded(
    ids: string[],
    manifests: Map<string, Manifest>,
    without: Set<string>,
    detected: Set<string>,
): string[] {
    const recommended = ids.flatMap((id) => manifests.get(id)?.preset.recommends ?? []);
    return [
        ...new Set([
            ...ids,
            ...recommended.filter((id) => {
                if (without.has(id)) return false;
                const kind = manifests.get(id)?.preset.kind;
                return (kind !== 'tool' && kind !== 'library') || detected.has(id);
            }),
        ]),
    ];
}

// An exact list (a profile that says so, or the answer to the selection question) gains no recommendation.
function listedPresets(
    options: InitInputs['options'],
    ids: string[],
    manifests: Map<string, Manifest>,
    detected: Set<string>,
): string[] {
    const isExact = options.profile?.tables.selection === 'exact' || options.isListExact === true;
    return isExact ? ids : recommendedAdded(ids, manifests, new Set(options.without), detected);
}

function reasonFor(id: string, sets: { named: Set<string>; chosen: Set<string>; listed: Set<string> }): PresetReason {
    if (sets.named.has(id)) return 'named';
    if (sets.chosen.has(id)) return 'detected';
    return sets.listed.has(id) ? 'recommended' : 'required';
}

function closure(ids: Iterable<string>, manifests: Map<string, Manifest>): Set<string> {
    const selected = new Set<string>();
    for (const id of ids) {
        const required = selectPresets([id], manifests);
        for (const manifest of required) selected.add(manifest.preset.name);
    }
    return selected;
}

/**
 * Selects the presets for init from detection, the --presets, --without and --scopes flags, and the workspace scopes.
 * @param inputs the root, the tracked files, the manifests read from the repository, the workspace scopes, every preset manifest and the init flags
 * @returns the scopes, the root and per-scope preset ids, and the closure of everything selected
 */
export function selectForInit(inputs: InitInputs): InitSelection {
    const { root, repo, facts, workspace, manifests, options } = inputs;
    const context: InitContext = { manifests, files: repo.files, facts, options };
    const scopeFlags = parseScopeFlags(options.scopes);
    assertKnown(options, scopeFlags, manifests);
    const scopes = initScopes(root, workspace, scopeFlags);
    const hasScopes = scopes.length > 1;
    const rootProposals = detectPresets(repo.files, manifests, facts);
    const proposedRoot = rootSelection(context, rootProposals, hasScopes);
    const scopeProposals = new Map<string, string[]>();
    const heldAtRoot = proposedRoot.filter((id) => {
        const manifest = manifests.get(id);
        return manifest?.preset.kind !== 'language' || !hasScopes || hasSourceOutsideScopes(context, manifest, scopes);
    });
    for (const scope of scopes)
        if (scope.path !== '')
            scopeProposals.set(scope.path, scopeSelection(context, scope, scopeFlags.get(scope.path), heldAtRoot));
    const inScopes = new Set(scopeProposals.values().toArray().flat());
    const keptRoot = hasScopes ? rootLanguagesKept(context, proposedRoot, scopes, inScopes) : proposedRoot;
    const rootIds = listedPresets(
        options,
        [...keptRoot, ...inScopes],
        manifests,
        new Set(rootProposals.map((proposal) => proposal.preset)),
    ).filter((id) => !inScopes.has(id));
    assertNoneRequired(options, [...rootIds, ...inScopes], manifests);
    const selectedIds = closure([...rootIds, ...inScopes], manifests);
    const sets = {
        named: new Set(options.presets ?? scopeFlags.values().toArray().flat()),
        chosen: new Set([...keptRoot, ...inScopes]),
        listed: new Set([...rootIds, ...inScopes]),
    };
    const how = new Map([...selectedIds].map((id) => [id, reasonFor(id, sets)]));
    return { scopes, rootIds, scopeProposals, selectedIds, rootProposals, how };
}
