// One session per command: the policy, the manifests, the repository, the selection and the merged view per scope.
import { loadPolicy } from '#cli/policy/load.ts';
import type { PolicyError } from '#cli/policy/load.ts';
import { mergeForScope } from '#cli/policy/merge.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import { buildSurface } from '#cli/policy/settings.ts';
import { assertPolicyComplete } from '#cli/policy/validate.ts';
import type { SettingsSurface } from '#cli/policy/settings.ts';
import { loadManifests } from '#cli/presets/load.ts';
import { selectForScope } from '#cli/presets/select.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import type { LoadedPolicy } from '#types/config.ts';
import type { Manifest } from '#types/manifest.ts';
import type { Repository, ScopeInfo } from '#types/repository.ts';

export type ScopeSelection = {
    scope: ScopeInfo;
    selected: Manifest[];
    surface: SettingsSurface;
    view: MergedView;
};

export type Session = {
    root: string;
    version: string;
    loaded: LoadedPolicy;
    manifests: Map<string, Manifest>;
    repository: Repository;
    scopes: ScopeSelection[];
    problems: string[];
};

/** Opens a session on a repository that has gspot.toml. Throws PolicyError or SelectionError. */
export async function openSession(root: string): Promise<Session> {
    const loaded = loadPolicy(root);
    assertPolicyComplete(loaded.policy);
    const manifests = loadManifests();
    const repository = await readRepository(root, loaded.policy.declares, loaded.policy.scopes);
    const scopes: ScopeSelection[] = [];
    const problems: string[] = [];
    for (const scope of repository.scopes) {
        const selected = selectForScope(loaded.policy.presets, scope.presets, manifests);
        const surface = buildSurface(selected);
        const view = mergeForScope(surface, loaded.policy, selected, scope.path);
        scopes.push({ scope, selected, surface, view });
    }
    if (problems.length > 0) {
        const error = new Error(problems.join('\n')) as PolicyError;
        error.name = 'PolicyError';
        (error as { problems: string[] }).problems = problems;
        throw error;
    }
    return { root, version: GSPOT_VERSION, loaded, manifests, repository, scopes, problems };
}

/** Every distinct manifest across the scopes, in first-seen order. */
export function everyManifest(session: Session): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of session.scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.preset.id)) seen.set(manifest.preset.id, manifest);
    return [...seen.values()];
}

/** The selection for a scope path, or the root's. */
export function scopeSelection(session: Session, path: string): ScopeSelection {
    return session.scopes.find((entry) => entry.scope.path === path) ?? session.scopes[0]!;
}
