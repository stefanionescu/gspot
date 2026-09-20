import type { Manifest } from '#types/manifest.ts';
import { mergeForScope } from '#cli/policy/merge.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
// One session per command: the policy, the manifests, the repository, the selection and the merged view per scope.
import { readPolicy } from '#cli/policy/read-policy.ts';
import { selectForScope } from '#cli/presets/select.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import type { ScopeSelection, Session } from '#types/run.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';

/**
 * Opens a session on a repository that has gspot.toml. Throws PolicyError or SelectionError.
 * @param root the repository root
 * @returns the session
 */
export async function openSession(root: string): Promise<Session> {
    const policyFiles = readPolicy(root);
    assertPolicyComplete(policyFiles.policy);
    const manifests = presetManifests();
    const repo = await readRepository(root, policyFiles.policy.declares, policyFiles.policy.scopes);
    const scopes: ScopeSelection[] = repo.scopes.map((scope) => {
        const selected = selectForScope(policyFiles.policy.presets, scope.presets, manifests);
        const surface = exposedSettings(selected);
        const view = mergeForScope(surface, policyFiles.policy, selected, scope.path);
        return { scope, selected, surface, view };
    });
    return { root, version: GSPOT_VERSION, policyFiles, manifests, repository: repo, scopes };
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param session the session
 * @returns the manifests
 */
export function everyManifest(session: Session): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of session.scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.preset.id)) seen.set(manifest.preset.id, manifest);
    return seen.values().toArray();
}
