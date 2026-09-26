// One session per command: the policy, the manifests, the repository, the selection and the merged view per scope.
import { npmPins } from '#cli/tools/pins.ts';
import { mergeForScope } from '#cli/policy/merge.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import packageManifest from '#package' with { type: 'json' };
import type { Manifest } from '#cli/types/configurations.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { exposedSettings } from '#cli/policy/setting-surface.ts';
import { toolPackageManager } from '#cli/tools/packages/manager.ts';
import type { ScopeEntry } from '#cli/types/repository/repository.ts';
import { readPolicy, assertPolicyComplete } from '#cli/policy/read.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import type { PolicyFiles, ScopeSelection, Policy } from '#cli/types/policy/policy.ts';

// Resolves every scope: its selected configurations, settings surface, and merged view.
function resolveScopes(policy: Policy, scopes: ScopeEntry[], manifests: Map<string, Manifest>): ScopeSelection[] {
    return scopes.map((scope) => {
        const selected = selectForScope(policy, scope.path, manifests);
        const surface = exposedSettings(selected);
        const view = mergeForScope(surface, policy, selected, scope.path);
        return { scope, selected, surface, view };
    });
}

const { version: GSPOT_VERSION } = packageManifest;

/**
 * Opens a session on a repository that has gspot.toml. Throws PolicyError or SelectionError.
 * @param root the repository root
 * @param policyFiles the policy as read, read here by default
 * @returns the session
 */
export async function openSession(root: string, policyFiles: PolicyFiles = readPolicy(root)): Promise<Session> {
    assertPolicyComplete(policyFiles);
    const manifests = configurationManifests();
    const repo = await readRepository(
        root,
        policyFiles.policy.declarations,
        policyFiles.policy.scopes,
        policyFiles.policy.exclude,
        new Set(
            readOwnership(root)
                .files.filter((entry) => entry.kind === 'runtime')
                .map((entry) => entry.path),
        ),
    );
    const scopes = resolveScopes(policyFiles.policy, repo.scopes, manifests);
    const runner = policyFiles.policy.runner?.tool;
    const needsPackages =
        Object.keys(
            npmPins(
                scopes.flatMap((scope) => scope.selected),
                runner,
            ),
        ).length > 0;
    const packageManager = needsPackages
        ? await toolPackageManager(
              root,
              repo.files.filter((file) => file.nature === 'source').map((file) => file.path),
          )
        : undefined;
    return {
        ...(packageManager === undefined ? {} : { packageManager }),
        root,
        version: GSPOT_VERSION,
        policyFiles,
        manifests,
        repository: repo,
        scopes,
        probes: new Map(),
        observations: { root, sources: new Map() },
    };
}
