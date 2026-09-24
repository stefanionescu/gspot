import type { PolicyFiles } from '#cli/types/policy.ts';
import { toolPackageManager } from '#cli/emit/tool-packages.ts';
import { npmPins } from '#cli/emit/runner-tasks.ts';
import { mergeForScope } from '#cli/policy/merge.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
// One session per command: the policy, the manifests, the repository, the selection and the merged view per scope.
import { readPolicy } from '#cli/policy/read-policy.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { readRepository } from '#cli/repository/tree.ts';
import { exposedSettings } from '#cli/policy/settings.ts';
import type { ScopeSelection, Session } from '#cli/types/execution.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';

/**
 * Opens a session on a repository that has gspot.toml. Throws PolicyError or SelectionError.
 * @param root the repository root
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
    );
    const scopes: ScopeSelection[] = repo.scopes.map((scope) => {
        const selected = selectForScope(policyFiles.policy, scope.path, manifests);
        const surface = exposedSettings(selected);
        const view = mergeForScope(surface, policyFiles.policy, selected, scope.path);
        return { scope, selected, surface, view };
    });
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
    };
}
