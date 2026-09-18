// What init selects: presets at the root and per scope from detection and flags, then the closure of requires.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Manifest } from '#types/manifest.ts';
import { detectPresets } from '#cli/presets/detect.ts';
import { selectPresets } from '#cli/presets/select.ts';
import type { ScopeEntry, TrackedFile } from '#types/repository.ts';
import type { InitContext, InitInputs, InitSelection } from '#types/emit.ts';

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
    for (const path of scopeFlags.keys())
        if (scopes.every((scope) => scope.path !== path) && existsSync(join(root, path)))
            scopes.push({ name: path.split('/').pop() ?? path, path, presets: [], source: 'gspot.toml' });
    return scopes;
}

function isRootCandidate(context: InitContext, preset: string, hasScopes: boolean, without: Set<string>): boolean {
    const manifest = context.manifests.get(preset);
    if (!manifest || without.has(preset)) return false;
    const { kind, proposed } = manifest.preset;
    if (hasScopes && kind !== 'repository' && kind !== 'language') return false;
    return !proposed || context.options.yes;
}

function rootSelection(context: InitContext, rootProposals: { preset: string }[], hasScopes: boolean): string[] {
    const without = new Set(context.options.without);
    if (context.options.presets) return context.options.presets.filter((id) => !without.has(id));
    return rootProposals
        .filter((proposal) => isRootCandidate(context, proposal.preset, hasScopes, without))
        .map((proposal) => proposal.preset);
}

function isScopeCandidate(context: InitContext, preset: string, without: Set<string>): boolean {
    const manifest = context.manifests.get(preset);
    if (!manifest || without.has(preset)) return false;
    return manifest.preset.kind !== 'repository' && (!manifest.preset.proposed || context.options.yes);
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

function closure(ids: Iterable<string>, manifests: Map<string, Manifest>): Set<string> {
    const selected = new Set<string>();
    for (const id of ids) {
        const required = selectPresets([id], manifests);
        for (const manifest of required) selected.add(manifest.preset.id);
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
    const scopes = initScopes(root, workspace, scopeFlags);
    const hasScopes = scopes.length > 1;
    const rootProposals = detectPresets(repo.files, manifests, facts);
    const proposedRoot = rootSelection(context, rootProposals, hasScopes);
    const scopeProposals = new Map<string, string[]>();
    for (const scope of scopes)
        if (scope.path !== '')
            scopeProposals.set(scope.path, scopeSelection(context, scope, scopeFlags.get(scope.path), proposedRoot));
    const inScopes = new Set(scopeProposals.values().toArray().flat());
    const rootIds = hasScopes ? rootLanguagesKept(context, proposedRoot, scopes, inScopes) : proposedRoot;
    const selectedIds = closure([...rootIds, ...inScopes], manifests);
    return { scopes, rootIds, scopeProposals, selectedIds, rootProposals };
}
